import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Skip redirect on the login endpoint itself
      const url: string = error.config?.url ?? "";
      if (!url.includes("/auth/token")) {
        localStorage.removeItem("token");
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default api;