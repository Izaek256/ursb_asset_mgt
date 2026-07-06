import { ICONS } from "../../utils/icons";
import Button from "./Button";

export type Props = {
  message: string;
  onDismiss?: () => void;
};

export default function SuccessBanner({ message, onDismiss }: Props) {
  return (
    <div className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-emerald-500/16 border border-emerald-500/30 backdrop-blur-md text-emerald-200 text-sm shadow-md animate-fadeIn motion-reduce:animate-none">
      <div className="flex items-center gap-2.5">
        <ICONS.checkCircle className="w-5 h-5 text-emerald-400 shrink-0" />
        <span className="font-medium">{message}</span>
      </div>
      {onDismiss && (
        <Button
          type="button"
          variant="icon"
          className="w-8 h-8 border-none bg-transparent shadow-none hover:shadow-none text-emerald-400 hover:text-emerald-200 hover:bg-emerald-500/10"
          onClick={onDismiss}
          aria-label="Dismiss banner"
        >
          <ICONS.close className="w-4 h-4 stroke-[2.4]" />
        </Button>
      )}
    </div>
  );
}
