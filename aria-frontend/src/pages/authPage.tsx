import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../contexts/AuthContext";
import "../styles/authPage.css";

export default function AuthPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        // Send as form data (OAuth2PasswordRequestForm expects username and password)
        const formData = new FormData();
        formData.append("username", email);
        formData.append("password", password);
        
        const res = await api.post("/auth/login", formData);
        console.log("Login response:", res.data);
        login(res.data.access_token);
        navigate("/dashboard", { replace: true });
      } else {
        // Register uses JSON
        await api.post("/auth/register", { email, password });
        setIsLogin(true);
        setError("Account created! Please log in.");
        setEmail("");
        setPassword("");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      console.error("Error details:", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      setError(err.response?.data?.detail || err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-header">
          <h1>{isLogin ? "Welcome back" : "Create account"}</h1>
          <p>{isLogin ? "Log in to your ARIA account" : "Get started with ARIA"}</p>
        </div>

        <div className="auth-inputs">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="auth-button"
        >
          {loading ? "Please wait..." : isLogin ? "Log in" : "Create account"}
        </button>

        <div className="auth-footer">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button onClick={() => { setIsLogin(!isLogin); setError(""); }}>
            {isLogin ? "Sign up" : "Log in"}
          </button>
        </div>
      </div>
    </div>
  );
}