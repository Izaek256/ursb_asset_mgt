import React, { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { ICONS } from "../utils/icons";
import Button from "./common/Button";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  onMinimize?: () => void;
};

export default function Modal({ open, onClose, title, children, onMinimize }: Props) {
  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50 select-none font-sans" onClose={onClose}>
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white border border-sky-cardBorder text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg p-5 sm:p-6">
                <div className="absolute right-4 top-4 flex items-center gap-2">
                  {onMinimize && (
                    <Button
                      type="button"
                      variant="icon"
                      className="w-8 h-8"
                      onClick={onMinimize}
                      aria-label="Minimize dialog"
                    >
                      <ICONS.minimize className="h-4 w-4 stroke-[2.4]" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="icon"
                    className="w-8 h-8"
                    onClick={onClose}
                    aria-label="Close dialog"
                  >
                    <ICONS.close className="h-4 w-4 stroke-[2.4]" />
                  </Button>
                </div>
                {title && (
                  <Dialog.Title
                    as="h3"
                    className="text-sm sm:text-base font-bold text-ink leading-tight mb-4 border-b border-sky-page/20 pb-3 pr-8"
                  >
                    {title}
                  </Dialog.Title>
                )}
                <div>{children}</div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
