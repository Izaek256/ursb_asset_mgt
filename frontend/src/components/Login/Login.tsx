import { ChangeEvent, useState } from "react";
import "./Login.css";

const DEPARTMENTS = [
  { value: "finance", label: "Finance" },
  { value: "it", label: "Information Technology (IT)" },
  { value: "hr", label: "Human Resources" },
  { value: "operations", label: "Operations" },
  { value: "procurement", label: "Procurement" },
  { value: "legal", label: "Legal" },
  { value: "marketing", label: "Marketing" },
  { value: "management", label: "Management" },
];

type ViewMode = "login" | "create";

type CreateForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  username: string;
  password: string;
  confirmPassword: string;
};

type CreateErrors = Partial<Record<keyof CreateForm | "api", string>>;

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="pwWrap">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={disabled ? "input inputDisabled pwInputPadded" : "input pwInputPadded"}
      />
      {!disabled && (
        <button type="button" className="pwToggle" onClick={() => setShow((current) => !current)}>
          {show ? "🙈" : "👁"}
        </button>
      )}
    </div>
  );
}

function LoginPanel({ onGoCreate, onSuccess }: { onGoCreate: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState("");

  const locked = attempts >= 3;

  const handleLogin = async () => {
    if (locked) return;
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      const res = await fetch("/api/v1/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        onSuccess();
        return;
      }

      const data = await res.json().catch(() => ({} as { detail?: string }));
      const serverMessage = data.detail ?? "Invalid email or password.";
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= 3) {
        setError(serverMessage);
      } else {
        setError(`${serverMessage} ${3 - newAttempts} attempt(s) remaining.`);
      }
    } catch {
      setError("Unable to connect to server. Please try again.");
    }
  };

  return (
    <div className="panel">
      {locked ? (
        <div className="lockBox">
          🔒 <strong>Account temporarily locked</strong>
          <p className="lockText">
            Too many failed attempts. Please contact your administrator or reset your password.
          </p>
        </div>
      ) : (
        <>
          {error && <div className="errorBox">{error}</div>}

          <div className="field">
            <label htmlFor="loginEmail" className="label">Email address</label>
            <input
              id="loginEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jane.doe@company.com"
              className="input"
            />
          </div>

          <div className="field">
            <label htmlFor="loginPassword" className="label">Password</label>
            <PasswordInput
              id="loginPassword"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />
            <button type="button" className="forgotBtn">
              Forgot password?
            </button>
          </div>

          {attempts > 0 && <p className="attemptsWarn">⚠ {attempts}/3 failed attempts</p>}
        </>
      )}

      <button type="button" className={locked ? "btnMain btnDisabled" : "btnMain"} onClick={handleLogin} disabled={locked}>
        Sign in
      </button>

      <button type="button" className="btnOutline" onClick={onGoCreate}>
        Create account
      </button>
    </div>
  );
}

function CreatePanel({ onGoLogin }: { onGoLogin: () => void }) {
  const [form, setForm] = useState<CreateForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    department: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<CreateErrors>({});
  const [success, setSuccess] = useState(false);

  const updateField = (key: keyof CreateForm) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const handleCreate = async () => {
    const validation: CreateErrors = {};

    if (!form.firstName.trim()) validation.firstName = "Required";
    if (!form.lastName.trim()) validation.lastName = "Required";
    if (!form.email.trim()) {
      validation.email = "Required";
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      validation.email = "Enter a valid email";
    }
    if (!form.phone.trim()) validation.phone = "Required";
    if (!form.department) validation.department = "Select a department";
    if (!form.username.trim()) validation.username = "Required";
    if (!form.password) validation.password = "Required";
    else if (form.password.length < 6) validation.password = "Minimum 6 characters";
    if (form.password !== form.confirmPassword) validation.confirmPassword = "Passwords do not match";

    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    try {
      const res = await fetch("/api/v1/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.firstName,
          last_name: form.lastName,
          email: form.email,
          phone_number: form.phone,
          department: form.department,
          username: form.username,
          password: form.password,
          confirm_password: form.confirmPassword,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        return;
      }

      const data = await res.json().catch(() => ({} as { detail?: string; message?: string }));
      setErrors({ api: data.detail ?? data.message ?? "Registration failed. Please try again." });
    } catch {
      setErrors({ api: "Unable to connect to server. Please try again." });
    }
  };

  if (success) {
    return (
      <div className="panel successPanel">
        <div className="successIcon">✅</div>
        <h2 className="successTitle">Account Created!</h2>
        <p className="successText">
          Your account has been created successfully. You can now sign in.
        </p>
        <button type="button" className="btnMain" onClick={onGoLogin}>
          Go to Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="panel">
      {errors.api && <div className="errorBox">{errors.api}</div>}

      <div className="sectionTag">👤 Personal details</div>
      <div className="row2">
        <div className="field">
          <label htmlFor="createFirstName" className="label">First name</label>
          <input id="createFirstName" type="text" value={form.firstName} onChange={updateField("firstName")} placeholder="Jane" className="input" />
          {errors.firstName && <p className="errorMsg">{errors.firstName}</p>}
        </div>
        <div className="field">
          <label htmlFor="createLastName" className="label">Last name</label>
          <input id="createLastName" type="text" value={form.lastName} onChange={updateField("lastName")} placeholder="Doe" className="input" />
          {errors.lastName && <p className="errorMsg">{errors.lastName}</p>}
        </div>
      </div>

      <div className="field">
        <label htmlFor="createEmail" className="label">Email address</label>
        <input id="createEmail" type="email" value={form.email} onChange={updateField("email")} placeholder="jane.doe@company.com" className="input" />
        {errors.email && <p className="errorMsg">{errors.email}</p>}
      </div>

      <div className="field">
        <label htmlFor="createPhone" className="label">Phone number</label>
        <input id="createPhone" type="tel" value={form.phone} onChange={updateField("phone")} placeholder="+256 700 000 000" className="input" />
        {errors.phone && <p className="errorMsg">{errors.phone}</p>}
      </div>

      <div className="field">
        <label htmlFor="createDepartment" className="label">Department</label>
        <select id="createDepartment" value={form.department} onChange={updateField("department")} className="input">
          <option value="" disabled>
            Select your department
          </option>
          {DEPARTMENTS.map((department) => (
            <option key={department.value} value={department.value}>
              {department.label}
            </option>
          ))}
        </select>
        {errors.department && <p className="errorMsg">{errors.department}</p>}
      </div>

      <div className="sep" />
      <div className="sectionTag">🔑 Account credentials</div>

      <div className="field">
        <label htmlFor="createUsername" className="label">Username</label>
        <input id="createUsername" type="text" value={form.username} onChange={updateField("username")} placeholder="Choose a username" className="input" />
        {errors.username && <p className="errorMsg">{errors.username}</p>}
      </div>

      <div className="field">
        <label htmlFor="createPassword" className="label">Password</label>
        <PasswordInput id="createPassword" value={form.password} onChange={updateField("password")} placeholder="Create a strong password" />
        {errors.password && <p className="errorMsg">{errors.password}</p>}
      </div>

      <div className="field">
        <label htmlFor="createConfirmPassword" className="label">Confirm password</label>
        <PasswordInput id="createConfirmPassword" value={form.confirmPassword} onChange={updateField("confirmPassword")} placeholder="Repeat your password" />
        {errors.confirmPassword && <p className="errorMsg">{errors.confirmPassword}</p>}
      </div>

      <button type="button" className="btnMain" onClick={handleCreate}>
        Create account
      </button>
      <button type="button" className="btnOutline" onClick={onGoLogin}>
        Back to Sign in
      </button>
    </div>
  );
}

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [view, setView] = useState<ViewMode>("login");
  const isLogin = view === "login";

  return (
    <div className="pageShell">
      <div className="brand">
        <div className="brandIcon">🏢</div>
        <span className="brandName">Staff Portal</span>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div className="avatarCircle">{isLogin ? "👤" : "✏️"}</div>
          <h1 className="cardHeaderTitle">{isLogin ? "Welcome back" : "Create account"}</h1>
          <p className="cardHeaderSub">
            {isLogin ? "Sign in to access your account" : "Fill in your details to get started"}
          </p>
        </div>

        {isLogin ? (
          <LoginPanel onGoCreate={() => setView("create")} onSuccess={onSuccess} />
        ) : (
          <CreatePanel onGoLogin={() => setView("login")} />
        )}
      </div>

      <p className="footer">Secure staff access portal — All rights reserved</p>
    </div>
  );
}
