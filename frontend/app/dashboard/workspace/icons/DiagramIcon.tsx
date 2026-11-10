interface DiagramIconProps {
  className?: string;
  color?: string;
}

export default function DiagramIcon({
  className = "w-6 h-6",
  color = "#333333"
}: DiagramIconProps) {
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
        d="M2.25 6C2.25 3.92893 3.92893 2.25 6 2.25C8.07107 2.25 9.75 3.92893 9.75 6C9.75 7.80475 8.4751 9.31173 6.77677 9.66945C7.09979 13.6919 10.3081 16.9002 14.3306 17.2232C14.6883 15.5249 16.1953 14.25 18 14.25C20.0711 14.25 21.75 15.9289 21.75 18C21.75 20.0711 20.0711 21.75 18 21.75C16.1776 21.75 14.6587 20.45 14.3204 18.7267C11.1309 18.5071 8.36339 16.7536 6.75 14.1985L6.75 21C6.75 21.4142 6.41421 21.75 6 21.75C5.58579 21.75 5.25 21.4142 5.25 21L5.25 9.67499C3.53832 9.32753 2.25 7.81422 2.25 6Z"
        fill={color}
      />
      <circle cx="6" cy="6" r="3" fill="white" />
      <circle cx="18" cy="18" r="3" fill="white" />
    </svg>
  );
}
