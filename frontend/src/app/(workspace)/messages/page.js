import { redirect } from "next/navigation";

const buildSearchString = (searchParams = {}) => {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) {
          params.append(key, item);
        }
      });
      return;
    }

    if (value) {
      params.set(key, value);
    }
  });

  return params.toString();
};

export default function MessagesRedirectPage({ searchParams }) {
  const query = buildSearchString(searchParams || {});

  redirect(query ? `/chat?${query}` : "/chat");
}
