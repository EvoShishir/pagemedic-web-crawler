import React from "react";
import {
  HiOutlineRocketLaunch,
  HiOutlineCursorArrowRays,
  HiOutlineDocumentText,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineXCircle,
  HiOutlineFire,
  HiOutlineNoSymbol,
  HiOutlineMagnifyingGlass,
  HiOutlineMagnifyingGlassPlus,
  HiOutlineLink,
  HiOutlineGlobeAlt,
  HiOutlinePhoto,
  HiOutlineClipboardDocumentList,
  HiOutlineChartBar,
  HiOutlineFlag,
  HiOutlineDocumentDuplicate,
  HiOutlineSparkles,
  HiOutlineCheck,
  HiOutlineArrowUturnRight,
  HiOutlineMapPin,
} from "react-icons/hi2";

const ICON_CLASS = "inline-block w-4 h-4 align-text-bottom mr-0.5";

const EMOJI_ICON_MAP: Record<string, React.ReactElement> = {
  "\u{1F680}": <HiOutlineRocketLaunch className={ICON_CLASS} />,
  "\u{1F3AF}": <HiOutlineCursorArrowRays className={ICON_CLASS} />,
  "\u{1F4C4}": <HiOutlineDocumentText className={ICON_CLASS} />,
  "\u2705": <HiOutlineCheckCircle className={ICON_CLASS} />,
  "\u26A0\uFE0F": <HiOutlineExclamationTriangle className={ICON_CLASS} />,
  "\u274C": <HiOutlineXCircle className={ICON_CLASS} />,
  "\u{1F525}": <HiOutlineFire className={ICON_CLASS} />,
  "\u{1F6AB}": <HiOutlineNoSymbol className={ICON_CLASS} />,
  "\u{1F50D}": <HiOutlineMagnifyingGlass className={ICON_CLASS} />,
  "\u{1F50E}": <HiOutlineMagnifyingGlassPlus className={ICON_CLASS} />,
  "\u{1F517}": <HiOutlineLink className={ICON_CLASS} />,
  "\u{1F310}": <HiOutlineGlobeAlt className={ICON_CLASS} />,
  "\u{1F5BC}\uFE0F": <HiOutlinePhoto className={ICON_CLASS} />,
  "\u{1F4CB}": <HiOutlineClipboardDocumentList className={ICON_CLASS} />,
  "\u{1F4CA}": <HiOutlineChartBar className={ICON_CLASS} />,
  "\u{1F3C1}": <HiOutlineFlag className={ICON_CLASS} />,
  "\u{1F4D1}": <HiOutlineDocumentDuplicate className={ICON_CLASS} />,
  "\u{1F389}": <HiOutlineSparkles className={ICON_CLASS} />,
  "\u2728": <HiOutlineSparkles className={ICON_CLASS} />,
  "\u2713": <HiOutlineCheck className={ICON_CLASS} />,
  "\u21B3": <HiOutlineArrowUturnRight className={`${ICON_CLASS} ml-2`} />,
  "\u{1F4CD}": <HiOutlineMapPin className={ICON_CLASS} />,
  "\u2693": <HiOutlineLink className={ICON_CLASS} />,
};

const emojiPattern = new RegExp(
  Object.keys(EMOJI_ICON_MAP)
    .sort((a, b) => b.length - a.length)
    .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
  "g"
);

export function replaceEmojisWithIcons(
  text: string,
  keyPrefix: string
): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  emojiPattern.lastIndex = 0;
  while ((match = emojiPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    const icon = EMOJI_ICON_MAP[match[0]];
    result.push(
      React.cloneElement(icon, { key: `${keyPrefix}-icon-${match.index}` })
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

export { EMOJI_ICON_MAP };
