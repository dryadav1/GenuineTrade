export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");

export const apiRequest = async (path, { method = "GET", body, token } = {}) => {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
  } catch (error) {
    throw new Error(
      `Cannot reach the GenuineTrade API at ${API_BASE_URL}. Make sure the backend server and MongoDB are running.`
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
};
