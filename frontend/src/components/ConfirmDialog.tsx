import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import Button from "./common/Button";

type Props = {
  open: boolean;
  title?: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  isLoading = false,
}: Props) {
  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50 select-none font-sans" onClose={onCancel}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300 motion-reduce:duration-0"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200 motion-reduce:duration-0"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-navy-deep/40 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300 motion-reduce:duration-0"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200 motion-reduce:duration-0"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white border border-sky-cardBorder text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md p-5 sm:p-6">
                {title && (
                  <Dialog.Title
                    as="h3"
                    className="text-sm sm:text-base font-bold text-ink leading-tight mb-3 border-b border-sky-page/20 pb-3"
                  >
                    {title}
                  </Dialog.Title>
                )}
                <div className="mb-6">
                  <p className="text-xs sm:text-sm text-ink-dim/95 leading-relaxed">{message}</p>
                </div>
                <div className="flex justify-end gap-2.5 border-t border-sky-page/20 pt-4">
                  <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="danger-outline"
                    onClick={onConfirm}
                    isLoading={isLoading}
                  >
                    Confirm & Apply
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
