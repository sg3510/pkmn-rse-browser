import React, { useEffect, useCallback } from 'react';
import { useDialog } from './DialogContext';

/**
 * DialogDemo - Test component for dialog system
 *
 * Press 'T' to trigger a test dialog sequence.
 * This demonstrates message, yes/no, and multichoice dialogs.
 */
export const DialogDemo: React.FC = () => {
  const dialog = useDialog();

  const runTestDialog = useCallback(async () => {
    // Don't start if already open
    if (dialog.isOpen) return;

    // Simple message
    await dialog.showMessage("Welcome to the Pokemon\nDialog System Demo!");

    // Multi-line message
    await dialog.showMessage("This system supports:\n- Typewriter effect\n- Multiple lines\n- Zoom scaling");

    // Yes/No dialog
    const wantMore = await dialog.showYesNo("Would you like to see\nmore features?");

    if (wantMore) {
      // Multichoice dialog
      const choice = await dialog.showChoice(
        "What would you like to do?",
        [
          { label: "POKEMON", value: "pokemon" },
          { label: "BAG", value: "bag" },
          { label: "SAVE", value: "save" },
          { label: "EXIT", value: "exit" },
        ]
      );

      if (choice && choice !== "exit") {
        await dialog.showMessage(`You selected: ${choice.toUpperCase()}\n\nGreat choice!`);
      } else {
        await dialog.showMessage("Goodbye!");
      }
    } else {
      await dialog.showMessage("No problem!\nPress T anytime to test again.");
    }
  }, [dialog]);

  // Listen for 'T' key to trigger test
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyT' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Don't trigger if typing in an input
        if (document.activeElement?.tagName === 'INPUT' ||
            document.activeElement?.tagName === 'TEXTAREA' ||
            document.activeElement?.tagName === 'SELECT') {
          return;
        }
        e.preventDefault();
        runTestDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [runTestDialog]);

  return null; // This component doesn't render anything visible
};

export default DialogDemo;
