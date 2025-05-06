import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  // You can add specific props here if needed later
}

const TelegramIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24" // Simple 24x24 viewbox
    className={className}
    fill="currentColor"
    {...props}
  >
    <path d="M9.78 18.65l.28-4.23l7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3L3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.51.71l-4.84-3.55l-2.31 2.24c-.25.24-.46.45-.9.45l.32-4.84z" />
  </svg>
);

export default TelegramIcon; 