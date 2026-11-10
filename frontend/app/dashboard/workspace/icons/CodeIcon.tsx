interface CodeIconProps {
  className?: string;
  color?: string;
}

export default function CodeIcon({
  className = "w-6 h-6",
  color = "#333333"
}: CodeIconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M17.0892 7.97388L17.3195 8.20413C19.1089 9.9935 20.0035 10.8882 20.0035 12C20.0035 13.1117 19.1089 14.0064 17.3195 15.7958L17.0892 16.026"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.8763 5L10.125 19"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.91076 7.97388L6.68051 8.20413C4.89114 9.9935 3.99646 10.8882 3.99646 12C3.99646 13.1117 4.89114 14.0064 6.68051 15.7958L6.91076 16.026"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
