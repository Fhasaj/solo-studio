"use client";

import { useEffect, useState } from "react";
import { MdArrowDropUp } from "react-icons/md";

export default function BackToTop() {
  const [scroll, setScroll] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScroll(window.scrollY !== 0);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!scroll) return null;

  return (
    <button
      aria-label="Back to top"
      className="fixed bottom-0 right-0 m-6 md:m-10 text-2xl text-textColour hover:cursor-finger bg-secondaryColour border border-borderColour hover:bg-accentColourGR hover:text-secondaryColour rounded-lg transition duration-300 ease-in-out p-3"
      onClick={() => window.scrollTo({ top: 0, behavior: "auto" })}
    >
      <MdArrowDropUp />
    </button>
  );
}
