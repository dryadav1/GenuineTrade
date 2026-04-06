/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
    "./src/lib/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0B1F3A",
        accent: "#2ECC71",
        canvas: "#F8FAFC",
        text: "#1F2937",
        surface: "#FFFFFF",
        line: "#D8E1EC",
        muted: "#667085",
        ink: "#081420",
        navy: "#16325B",
        success: "#1F9D5C",
        warning: "#D97706",
        danger: "#DC2626"
      },
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"]
      },
      borderRadius: {
        shell: "28px"
      },
      boxShadow: {
        panel: "0 18px 42px rgba(11, 31, 58, 0.08)",
        shell: "0 26px 72px rgba(11, 31, 58, 0.12)",
        float: "0 24px 64px rgba(11, 31, 58, 0.16)",
        glow: "0 18px 45px rgba(46, 204, 113, 0.16)"
      },
      backgroundImage: {
        "grid-light":
          "linear-gradient(rgba(11, 31, 58, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(11, 31, 58, 0.05) 1px, transparent 1px)",
        "hero-wash":
          "radial-gradient(circle at top left, rgba(46, 204, 113, 0.18), transparent 28%), radial-gradient(circle at 85% 15%, rgba(11, 31, 58, 0.14), transparent 26%), linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.98))",
        "shell-wash":
          "radial-gradient(circle at top, rgba(46, 204, 113, 0.12), transparent 24%), radial-gradient(circle at 80% 10%, rgba(255,255,255,0.12), transparent 22%), linear-gradient(180deg, rgba(17, 40, 72, 0.98), rgba(8, 20, 32, 0.96))",
        "surface-glow":
          "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.84))"
      }
    }
  },
  plugins: []
};
