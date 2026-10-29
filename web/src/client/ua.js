// Inline at the end of <body> (design.md 9, M9): Android-only "Open in the app" buttons are rendered only when the UA is
// Android; everyone else sees the Play button alone. The CSS rule is html[data-ua="android"] .android-only { display }.
(function () {
  if (/Android/i.test(navigator.userAgent)) document.documentElement.setAttribute('data-ua', 'android');
})();
