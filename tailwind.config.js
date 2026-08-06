/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/screens/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        paper: '#FAF8F5',
        paperDim: '#F0ECE3',
        rule: '#EAE4D7',
        ink: '#1A1D2D',
        inkSoft: '#6E738A',
        sky: '#4F86C6',
        skyDeep: '#284E7D',
        sun: '#F5A65B',
        emerald: '#2A8563',
        primary: '#2A8563',
        coral: '#2A8563',
        tape: '#F3D382',
        tapeBlue: '#9BC4CB',
        card: '#FFFFFF',
        good: '#3A8E71',
        mapGreen: '#2E9E5B',
        tealAccent: '#3B7A9E',
        tealDark: '#1F4E67',
        orangeAccent: '#F0A93E',
        redAccent: '#E2604A',
        lightOrangeBg: '#FDEBD3',
        lightRedBg: '#FBE7E1',
        lightGreenBg: '#E4F0EA',
        lightBlueBg: '#E4F0F4',
      },
    },
  },
  plugins: [],
};
