"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import ChatSkeleton from "@/components/common/ChatSkeleton";
import EmptyState from "@/components/common/EmptyState";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { API_ORIGIN, apiRequest } from "@/lib/api";
import TypingIndicator from "@/components/common/TypingIndicator";
import { formatDateTime } from "@/lib/format";
import { readFileAsDataUrl } from "@/lib/files";
import { messageBubbleVariants, messageStackVariants } from "@/lib/motion";
import { getSocketClient } from "@/lib/socket";
import { useWorkspaceSession } from "@/lib/workspace";

const sortConversations = (items = []) =>
  [...items].sort((left, right) => {
    const leftValue = new Date(
      left.lastMessage?.createdAt || left.updatedAt || 0
    ).getTime();
    const rightValue = new Date(
      right.lastMessage?.createdAt || right.updatedAt || 0
    ).getTime();

    return rightValue - leftValue;
  });

const upsertConversation = (items, nextConversation) => {
  const nextItems = (items || []).filter(
    (item) => item.conversationId !== nextConversation.conversationId
  );
  nextItems.unshift(nextConversation);
  return sortConversations(nextItems);
};

const resolveAssetUrl = (value) => {
  if (!value) {
    return "";
  }

  if (value.startsWith("http")) {
    return value;
  }

  return `${API_ORIGIN}${value}`;
};

const formatConversationTime = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short"
  });
};

const buildResolverPayload = (searchParams) => {
  const fields = [
    "conversationId",
    "threadId",
    "matchId",
    "transactionId",
    "buyerId",
    "exporterId",
    "rfqId"
  ];

  return fields.reduce((payload, field) => {
    const value = searchParams.get(field) || "";
    if (value) {
      payload[field] = value;
    }
    return payload;
  }, {});
};

const hasResolverPayload = (payload) =>
  Object.values(payload || {}).some((value) => Boolean(value));

const normalizeMessage = (message, currentUserId) => ({
  ...message,
  isMine:
    typeof message.isMine === "boolean"
      ? message.isMine
      : message.sender?.id === currentUserId
});

const sendSocketEvent = (socket, eventName, payload) =>
  new Promise((resolve, reject) => {
    socket.emit(eventName, payload, (response = {}) => {
      if (response.ok) {
        resolve(response);
        return;
      }

      reject(new Error(response.message || "Socket request failed"));
    });
  });

function ChatWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, ready } = useWorkspaceSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const tempMessageRef = useRef("");

  const resolverKey = searchParams.toString();
  const resolverPayload = useMemo(
    () => buildResolverPayload(searchParams),
    [resolverKey, searchParams]
  );
  const currentUserId = session?.user?.id || "";

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.conversationId === selectedConversationId
      ) || null,
    [conversations, selectedConversationId]
  );

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const counterpart = conversation.counterpart || {};
      const haystack = [
        counterpart.companyName,
        counterpart.name,
        counterpart.email,
        conversation.lastMessage?.text
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [conversations, search]);

  const loadConversations = async (preferredConversationId = "") => {
    const data = await apiRequest("/messages/conversations", {
      token: session.token
    });
    const nextItems = sortConversations(data.items || []);
    setConversations(nextItems);

    const fallbackConversationId =
      preferredConversationId ||
      (nextItems[0]?.conversationId ? nextItems[0].conversationId.toString() : "");

    if (fallbackConversationId) {
      setSelectedConversationId(fallbackConversationId);
    }
  };

  const updateRouteForConversation = (conversationId) => {
    if (!conversationId) {
      return;
    }

    router.replace(`/chat?conversationId=${encodeURIComponent(conversationId)}`);
  };

  const resolveConversation = async (payload = resolverPayload) => {
    if (!hasResolverPayload(payload)) {
      return null;
    }

    const response = await apiRequest("/messages/conversations/resolve", {
      method: "POST",
      token: session.token,
      body: payload
    });
    const nextConversation = response.conversation;

    if (nextConversation) {
      setConversations((current) => upsertConversation(current, nextConversation));
      setSelectedConversationId(nextConversation.conversationId);
      updateRouteForConversation(nextConversation.conversationId);
    }

    return nextConversation;
  };

  const markConversationRead = async (conversationId) => {
    if (!conversationId || !session?.token) {
      return;
    }

    try {
      const response = await apiRequest(
        `/messages/conversations/${encodeURIComponent(conversationId)}/read`,
        {
          method: "PATCH",
          token: session.token
        }
      );

      if (response.conversation) {
        setConversations((current) =>
          upsertConversation(current, response.conversation)
        );
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => {
    if (!ready || !session) {
      return;
    }

    if (session.user.role === "admin") {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        let preferredConversationId = "";

        if (hasResolverPayload(resolverPayload)) {
          const resolvedConversation = await resolveConversation(resolverPayload);
          preferredConversationId = resolvedConversation?.conversationId || "";
        }

        const data = await apiRequest("/messages/conversations", {
          token: session.token
        });
        const nextItems = sortConversations(data.items || []);

        if (cancelled) {
          return;
        }

        setConversations(nextItems);

        const selectedId =
          preferredConversationId ||
          resolverPayload.conversationId ||
          nextItems[0]?.conversationId ||
          "";

        setSelectedConversationId(selectedId);

        if (preferredConversationId) {
          updateRouteForConversation(preferredConversationId);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [ready, resolverKey, resolverPayload, session]);

  useEffect(() => {
    if (!selectedConversationId || !session?.token || session.user.role === "admin") {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const loadMessages = async () => {
      try {
        const data = await apiRequest(
          `/messages/conversations/${encodeURIComponent(selectedConversationId)}/messages?page=1&limit=50`,
          {
            token: session.token
          }
        );

        if (cancelled) {
          return;
        }

        setMessages(
          (data.items || []).map((message) =>
            normalizeMessage(message, currentUserId)
          )
        );

        if (data.conversation) {
          setConversations((current) =>
            upsertConversation(current, data.conversation)
          );
        }

        await markConversationRead(selectedConversationId);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message);
        }
      }
    };

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, selectedConversationId, session?.token, session?.user?.role]);

  useEffect(() => {
    if (!session?.token || session.user.role === "admin") {
      return;
    }

    const socket = getSocketClient(session.token);

    const handleReceiveMessage = (incomingMessage) => {
      const normalizedMessage = normalizeMessage(incomingMessage, currentUserId);

      setMessages((current) => {
        if (normalizedMessage.conversationId !== selectedConversationId) {
          return current;
        }

        if (current.some((item) => item.id === normalizedMessage.id)) {
          return current;
        }

        return [...current, normalizedMessage];
      });

      if (
        normalizedMessage.conversationId === selectedConversationId &&
        normalizedMessage.sender?.id !== currentUserId
      ) {
        markConversationRead(selectedConversationId);
      }
    };

    const handleConversationUpdate = ({ conversation } = {}) => {
      if (!conversation) {
        loadConversations(selectedConversationId);
        return;
      }

      setConversations((current) => upsertConversation(current, conversation));
    };

    const handlePresenceUpdate = ({ userId, isOnline }) => {
      setConversations((current) =>
        current.map((conversation) =>
          conversation.counterpart?.userId === userId
            ? {
                ...conversation,
                counterpart: {
                  ...conversation.counterpart,
                  isOnline
                }
              }
            : conversation
        )
      );
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("conversation_updated", handleConversationUpdate);
    socket.on("presence:update", handlePresenceUpdate);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("conversation_updated", handleConversationUpdate);
      socket.off("presence:update", handlePresenceUpdate);
    };
  }, [currentUserId, selectedConversationId, session?.token, session?.user?.role]);

  useEffect(() => {
    if (!selectedConversationId || !session?.token || session.user.role === "admin") {
      return;
    }

    const socket = getSocketClient(session.token);
    sendSocketEvent(socket, "join_room", {
      conversationId: selectedConversationId
    }).catch(() => {});
  }, [selectedConversationId, session?.token, session?.user?.role]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    const handleFocus = () => {
      markConversationRead(selectedConversationId);
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [selectedConversationId]);

  const handleSelectConversation = (conversationId) => {
    setSelectedConversationId(conversationId);
    updateRouteForConversation(conversationId);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const clearComposer = () => {
    setDraft("");
    setSelectedFile(null);
    tempMessageRef.current = "";

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadAttachment = async (conversationId) => {
    if (!selectedFile) {
      return [];
    }

    const filePayload = await readFileAsDataUrl(selectedFile, {
      includeMetadata: true
    });
    const response = await apiRequest("/messages/attachments", {
      method: "POST",
      token: session.token,
      body: {
        conversationId,
        file: {
          name: filePayload.name,
          type: filePayload.type,
          size: filePayload.size,
          dataUrl: filePayload.dataUrl
        }
      }
    });

    return response.attachment ? [response.attachment] : [];
  };

  const ensureConversationForSend = async () => {
    if (selectedConversationId) {
      return selectedConversationId;
    }

    const nextConversation = await resolveConversation(resolverPayload);
    if (!nextConversation?.conversationId) {
      throw new Error(
        "Open an existing conversation or start chat from a match, RFQ, or transaction."
      );
    }

    return nextConversation.conversationId;
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();

    if (!draft.trim() && !selectedFile) {
      return;
    }

    setSending(true);
    setError("");

    try {
      const conversationId = await ensureConversationForSend();
      const attachments = await uploadAttachment(conversationId);
      const socket = getSocketClient(session.token);
      const temporaryId = `temp-${Date.now()}`;
      tempMessageRef.current = temporaryId;

      const temporaryMessage = {
        id: temporaryId,
        conversationId,
        body: draft.trim(),
        attachments,
        createdAt: new Date().toISOString(),
        sender: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name
        },
        isMine: true,
        pending: true
      };

      setMessages((current) => [...current, temporaryMessage]);

      const response = await sendSocketEvent(socket, "send_message", {
        conversationId,
        body: draft.trim(),
        attachments
      });

      if (response.conversation) {
        setConversations((current) =>
          upsertConversation(current, response.conversation)
        );
      }

      if (response.message) {
        setMessages((current) => {
          const withoutTemp = current.filter((item) => item.id !== temporaryId);
          const normalizedMessage = normalizeMessage(response.message, currentUserId);

          if (withoutTemp.some((item) => item.id === normalizedMessage.id)) {
            return withoutTemp;
          }

          return [...withoutTemp, normalizedMessage];
        });
      }

      clearComposer();
      setSelectedConversationId(conversationId);
      updateRouteForConversation(conversationId);
    } catch (requestError) {
      setMessages((current) =>
        current.filter((item) => item.id !== tempMessageRef.current)
      );
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  };

  if (!ready || !session || loading) {
    return (
      <AppShell
        session={session || { user: { role: "buyer", email: "Loading" } }}
        title="Chat"
        subtitle="Loading your real-time trade conversations."
      >
        <ChatSkeleton />
      </AppShell>
    );
  }

  if (session.user.role === "admin") {
    return (
      <AppShell
        session={session}
        title="Chat"
        subtitle="Real-time trade chat is reserved for buyers and exporters."
      >
        <EmptyState
          title="No direct chat for admin accounts"
          description="Admin workspaces monitor platform activity indirectly through notifications, analytics, and transaction oversight."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      session={session}
      title="Chat"
      subtitle="Negotiate, share documents, and move deals forward in real time."
    >
      {error ? (
        <div className="rounded-3xl border border-danger/20 bg-danger/10 px-5 py-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-shell border border-line bg-white shadow-shell">
        <div className="grid min-h-[72vh] lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="border-b border-line bg-canvas/70 lg:border-b-0 lg:border-r">
            <div className="border-b border-line p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                Inbox
              </p>
              <h2 className="mt-3 text-2xl font-bold text-primary">Conversations</h2>
              <div className="mt-4 rounded-2xl border border-line bg-white px-4 py-3">
                <input
                  className="w-full bg-transparent text-sm text-text outline-none"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search company, contact, or message"
                  value={search}
                />
              </div>
            </div>

            <motion.div
              animate="animate"
              className="max-h-[72vh] overflow-y-auto"
              initial="initial"
              variants={messageStackVariants}
            >
              {filteredConversations.length ? (
                filteredConversations.map((conversation) => (
                  <motion.button
                    key={conversation.conversationId}
                    className={`w-full border-b border-line px-5 py-4 text-left transition ${
                      selectedConversationId === conversation.conversationId
                        ? "bg-primary/6"
                        : "hover:bg-white"
                    }`}
                    onClick={() =>
                      handleSelectConversation(conversation.conversationId)
                    }
                    type="button"
                    variants={messageBubbleVariants}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-primary">
                            {conversation.counterpart?.companyName ||
                              conversation.counterpart?.name ||
                              "Trade conversation"}
                          </p>
                          <span
                            className={`inline-flex h-2.5 w-2.5 rounded-full ${
                              conversation.counterpart?.isOnline
                                ? "bg-success"
                                : "bg-primary/20"
                            }`}
                          />
                        </div>
                        <p className="mt-1 truncate text-xs text-primary/45">
                          {conversation.counterpart?.name ||
                            conversation.counterpart?.email ||
                            "Buyer / Exporter"}
                        </p>
                        <p className="mt-2 truncate text-sm text-muted">
                          {conversation.lastMessage?.text || "No messages yet"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-primary/45">
                          {formatConversationTime(
                            conversation.lastMessage?.createdAt || conversation.updatedAt
                          )}
                        </p>
                        {conversation.unreadCount ? (
                          <span className="mt-2 inline-flex rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </motion.button>
                ))
              ) : (
                <div className="p-5">
                  <EmptyState
                    title="No conversations yet"
                    description="Start from a match, RFQ, or transaction to open your first trade conversation."
                  />
                </div>
              )}
            </motion.div>
          </aside>

          <section className="flex min-h-[72vh] flex-col">
            <div className="border-b border-line px-6 py-5">
              {activeConversation ? (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                      Active chat
                    </p>
                    <h3 className="mt-2 text-2xl font-bold text-primary">
                      {activeConversation.counterpart?.companyName ||
                        activeConversation.counterpart?.name ||
                        "Conversation"}
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      {activeConversation.counterpart?.isOnline
                        ? "Online now"
                        : "Offline"}{" "}
                      {activeConversation.counterpart?.name
                        ? `| ${activeConversation.counterpart.name}`
                        : ""}
                    </p>
                  </div>

                  {activeConversation.transaction?.id ? (
                    <span className="rounded-full border border-line bg-canvas px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary/55">
                      Trade secured
                    </span>
                  ) : null}
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                    Chat
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-primary">
                    Select a conversation
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    Choose a conversation from the left panel or start one from the match center.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col bg-[#F8FBFF]">
              <motion.div
                animate="animate"
                className="flex-1 space-y-4 overflow-y-auto px-6 py-6"
                initial="initial"
                variants={messageStackVariants}
              >
                {messages.length ? (
                  <AnimatePresence initial={false}>
                    {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      className={`flex ${
                        message.isMine ? "justify-end" : "justify-start"
                      }`}
                      layout
                      variants={messageBubbleVariants}
                    >
                      <div
                        className={`max-w-[82%] rounded-[28px] px-4 py-3 shadow-sm ${
                          message.isMine
                            ? "bg-primary text-white"
                            : "bg-white text-primary"
                        }`}
                      >
                        {message.body ? (
                          <p className="text-sm leading-7">{message.body}</p>
                        ) : null}

                        {message.attachments?.length ? (
                          <div className={`${message.body ? "mt-3" : ""} space-y-3`}>
                            {message.attachments.map((attachment) => (
                              <div
                                key={`${message.id}-${attachment.url}`}
                                className={`overflow-hidden rounded-2xl border ${
                                  message.isMine
                                    ? "border-white/20 bg-white/10"
                                    : "border-line bg-canvas"
                                }`}
                              >
                                {attachment.type === "image" ? (
                                  <a
                                    href={resolveAssetUrl(attachment.url)}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    <img
                                      alt={attachment.name || "Chat attachment"}
                                      className="max-h-72 w-full object-cover"
                                      src={resolveAssetUrl(attachment.url)}
                                    />
                                  </a>
                                ) : (
                                  <a
                                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold"
                                    href={resolveAssetUrl(attachment.url)}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    <span className="truncate">{attachment.name || "Attachment"}</span>
                                    <span className="shrink-0 text-xs uppercase tracking-[0.18em]">
                                      PDF
                                    </span>
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <p
                          className={`mt-2 text-[11px] ${
                            message.isMine ? "text-white/65" : "text-primary/45"
                          }`}
                        >
                          {message.pending ? "Sending..." : formatDateTime(message.createdAt)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  </AnimatePresence>
                ) : activeConversation ? (
                  <EmptyState
                    title="No messages yet"
                    description="Send the first message to begin the negotiation."
                  />
                ) : (
                  <EmptyState
                    title="Nothing selected"
                    description="Choose a conversation from the inbox to view messages."
                  />
                )}
                {sending ? <TypingIndicator label="Sending" /> : null}
                <div ref={messagesEndRef} />
              </motion.div>

              <form
                className="border-t border-line bg-white px-6 py-5"
                onSubmit={handleSendMessage}
              >
                {selectedFile ? (
                  <div className="mb-4 flex items-center justify-between rounded-2xl border border-line bg-canvas px-4 py-3 text-sm text-primary">
                    <span className="truncate pr-4">
                      Attachment: {selectedFile.name}
                    </span>
                    <button
                      className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/50"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}

                <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                  <div className="flex-1">
                    <label className="label" htmlFor="chatMessage">
                      Message
                    </label>
                    <textarea
                      id="chatMessage"
                      className="field min-h-[120px]"
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Discuss price, lead times, certifications, or next steps."
                      value={draft}
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 lg:w-[220px] lg:flex-col">
                    <label className="btn-secondary cursor-pointer text-center">
                      Attach file
                      <input
                        ref={fileInputRef}
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        className="hidden"
                        onChange={handleFileChange}
                        type="file"
                      />
                    </label>
                    <button className="btn-primary" disabled={sending} type="submit">
                      {sending ? (
                        <>
                          <LoadingSpinner className="h-4 w-4" tone="#FFFFFF" />
                          Sending...
                        </>
                      ) : (
                        "Send"
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <AppShell
          session={{ user: { role: "buyer", email: "Loading" } }}
          title="Chat"
          subtitle="Loading your real-time trade conversations."
        >
          <ChatSkeleton />
        </AppShell>
      }
    >
      <ChatWorkspace />
    </Suspense>
  );
}
