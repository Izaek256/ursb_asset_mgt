import { FormEvent, useState } from "react";
import "./Login.css";

interface LoginForm {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phoneNumber: string;
  department: string;
  password: string;
  confirmPassword: string;
}

interface LoginProps {
  onSuccess: () => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [form, setForm] = useState<LoginForm>({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    phoneNumber: "",
    department: "",
    password: "",
    confirmPassword: "",
  });
  const [isSignup, setIsSignup] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const endpoint = isSignup ? "/api/v1/signup" : "/api/v1/login";
    const payload = isSignup
      ? form
      : {
          email: form.email,
          password: form.password,
        };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.detail ?? "Unable to complete the request. Please check your details.");
        return;
      }

      if (isSignup) {
        setMessage("Account created successfully. Please sign in.");
        setIsSignup(false);
        setForm({
          ...form,
          password: "",
          confirmPassword: "",
        });
        return;
      }

      setMessage(data.message || "Login successful.");
      onSuccess();
    } catch (err) {
      setError("Unable to connect to the server.");
    }
  };

  const toggleMode = () => {
    setIsSignup((current) => !current);
    setMessage(null);
    setError(null);
  };

  return (
    <div className="card">
      <div className="pageHeader">
        <div className="logoMark">URSB</div>
        <div>
          <h1>{isSignup ? "Create your account" : "Staff Portal"}</h1>
          <p>{isSignup ? "Register a new staff account to access the portal." : "Sign in to access your account."}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {isSignup && (
          <>
            <div className="fieldGroup">
              <label htmlFor="firstName" className="fieldLabel">
                First name
              </label>
              <input
                id="firstName"
                type="text"
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                placeholder="Jane"
                required
                className="textInput"
              />
            </div>

            <div className="fieldGroup">
              <label htmlFor="lastName" className="fieldLabel">
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                placeholder="Doe"
                required
                className="textInput"
              />
            </div>

            <div className="fieldGroup">
              <label htmlFor="username" className="fieldLabel">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                placeholder="choose-a-username"
                required
                className="textInput"
              />
            </div>

            <div className="fieldGroup">
              <label htmlFor="phoneNumber" className="fieldLabel">
                Phone number
              </label>
              <input
                id="phoneNumber"
                type="tel"
                value={form.phoneNumber}
                onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })}
                placeholder="+256 700 000 000"
                required
                className="textInput"
              />
            </div>

            <div className="fieldGroup">
              <label htmlFor="department" className="fieldLabel">
                Department
              </label>
              <select
                id="department"
                value={form.department}
                onChange={(event) => setForm({ ...form, department: event.target.value })}
                required
                className="textInput"
              >
                <option value="">Select your department</option>
                <option value="Finance">Finance</option>
                <option value="Human Resources">Human Resources</option>
                <option value="IT">IT</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
          </>
        )}

        <div className="fieldGroup">
          <label htmlFor="email" className="fieldLabel">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="jane.doe@company.com"
            required
            className="textInput"
          />
        </div>

        <div className="fieldGroup">
          <label htmlFor="password" className="fieldLabel">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="Enter your password"
            required
            className="textInput"
          />
        </div>

        {isSignup && (
          <div className="fieldGroup">
            <label htmlFor="confirmPassword" className="fieldLabel">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
              placeholder="Repeat your password"
              required
              className="textInput"
            />
          </div>
        )}

        <button type="submit" className="actionButton">
          {isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <div className="footerAction">
        <span>{isSignup ? "Already have an account?" : "Need a new account?"}</span>
        <button type="button" className="textButton" onClick={toggleMode}>
          {isSignup ? "Sign in" : "Create one"}
        </button>
      </div>

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}
    </div>
  );
}
