// Answer key for the twenty secrets. Server only: nothing under app/ may
// import this, because a client component bundles everything it imports into
// the browser payload. The sole importer is app/api/admin/secrets/route.js,
// a route handler. Index is the secret number minus one, matching SECRET_LABELS.

export const SECRET_HOWTO = [
  /*  1 */ "Press Up Up Down Down Left Right Left Right B A anywhere on the page. (Konami Code)",
  /*  2 */ "Click the 'Vault' icon in the header five times quickly. Fault spawned.",
  /*  3 */ "Hold the main title for 1.2 seconds. Core unlocked.",
  /*  4 */ "Type O-P-E-N outside text fields. Gate opened.",
  /*  5 */ "Click the program/download/featured counters five times quickly. Audit spiked.",
  /*  6 */ "Hover footer \"Vault\" text while holding Alt for 2.5 seconds. Trace detected.",
  /*  7 */ "Hold a program title for 1.5 seconds. Card fault triggered.",
  /*  8 */ "Type debug in search and press Enter. Debug mode active.",
  /*  9 */ "Shift+click the theme switch. Schema override injected.",
  /* 10 */ "Toggle theme ten times rapidly. Schema fractured.",
  /* 11 */ "Right-click and hold on any program card for 2 seconds. Data cascade initiated.",
  /* 12 */ "Click the featured badge (★) 7 times rapidly. Vault resonates.",
  /* 13 */ "Click a category chip whose count reads (0).",
  /* 14 */ "Type I-D-D-Q-D outside text fields. (Doom)",
  /* 15 */ "Search 3+ characters that match no program, and stay on the empty result ~1s.",
  /* 16 */ "Switch the language selector through all 8 languages in one session.",
  /* 17 */ "Ctrl+click (or Cmd+click) the header logo.",
  /* 18 */ "Press Escape three times within two seconds.",
  /* 19 */ "Switch on ALL SIX platform filters at once (Windows, macOS, Linux, Android, iOS, Web). "
         + "Order does not matter; the sixth one showing as active fires it.",
  /* 20 */ "Leave the page completely alone — no mouse, key, scroll or touch — for 30 minutes "
         + "with the tab visible. Switching tabs restarts the clock. The overlay is held back "
         + "until you touch the page again, so it is never shown to an empty chair.",
];
