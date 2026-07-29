import React from "react";
import Modal from "./Modal";
import Button from "./common/Button";
import { ICONS } from "../utils/icons";

interface ReloadConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  jobCount: number;
}

export default function ReloadConfirmationModal({
  isOpen,
  onConfirm,
  onCancel,
  jobCount,
}: ReloadConfirmationModalProps) {
  return (
    <Modal open={isOpen} onClose={onCancel} title="Confirm Reload">
      <div className="flex flex-col gap-6">
        {/* Warning icon and message */}
        <div className="flex items-start gap-4">
          <div className="bg-amber-50 p-3 rounded-full border border-amber-100 shrink-0">
            <ICONS.alert className="w-6 h-6 text-amber-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-ink mb-2">
              Import in Progress
            </h3>
            <p className="text-sm text-ink-dim leading-relaxed">
              {jobCount === 1
                ? "There is an import process currently running."
                : `There are ${jobCount} import processes currently running.`}
            </p>
          </div>
        </div>

        {/* What will happen section */}
        <div className="bg-sky-page/30 border border-sky-cardBorder rounded-xl p-4">
          <p className="text-xs font-bold text-ink mb-2 uppercase tracking-wider">
            What will happen if you reload:
          </p>
          <ul className="text-sm text-ink-dim space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">•</span>
              <span>All running import processes will be terminated</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">•</span>
              <span>Any database changes made during the import will be rolled back</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">•</span>
              <span>You will need to restart the import from the beginning</span>
            </li>
          </ul>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel Reload
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Reload Anyway
          </Button>
        </div>
      </div>
    </Modal>
  );
}
