export const BUILD_INFO = {
  mode: import.meta.env.MODE,
  commit:
    import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA ||
    import.meta.env.VITE_GIT_COMMIT ||
    "unknown",
};
