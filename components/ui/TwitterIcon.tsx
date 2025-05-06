import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  // You can add specific props here if needed later
}

const TwitterIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 300 300.251" // Using viewBox from the found SVG
    className={className}
    fill="currentColor" // Use currentColor for styling via text color classes
    {...props}
  >
    <path d="M178.57 127.15 290.27 0h-26.46l-97.03 110.38L89.34 0H0l117.13 166.94L0 300.25h26.46l102.4-116.07 85.45 116.07h89.34L178.57 127.15Zm-20.75 24.23-6.6-9.4-99.37-140.62h40.48l80.8 115.03 6.6 9.4 104.8 148.17h-40.48l-86.07-122.6Z"/>
  </svg>
);

export default TwitterIcon; 