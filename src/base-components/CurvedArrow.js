import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { scale } from '../utils/scale';
import { colors } from '../constants/colors';

const CurvedArrow = () => (
  <Svg width={scale(100)} height={scale(118)} viewBox="0 0 140 160" fill="none">
    {/* blue glow */}
    <Path
      d="M38 14 C28 45 25 85 45 105 C60 120 86 118 108 112"
      stroke={colors.appPrimary}
      strokeWidth="13"
      strokeOpacity="0.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M90 98 L110 112 L92 130"
      stroke={colors.appPrimary}
      strokeWidth="13"
      strokeOpacity="0.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* black arrow */}
    <Path
      d="M38 14 C28 45 25 85 45 105 C60 120 86 118 108 112"
      stroke={'#fff'}
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M90 98 L110 112 L92 130"
      stroke={'#fff'}
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default CurvedArrow;
