import { Switch } from "@headlessui/react";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export default function ToggleSwitch({ checked, onChange, disabled }: Props) {
  return (
    <Switch
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ursb/30 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed motion-reduce:transition-none ${
        checked ? "bg-ursb" : "bg-sky-border/60"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out motion-reduce:transition-none ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </Switch>
  );
}
