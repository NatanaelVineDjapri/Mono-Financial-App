// Temporary type declarations for react-native-gifted-charts
// Remove this file after installing the actual library
declare module 'react-native-gifted-charts' {
  import type { TextStyle } from 'react-native';

  export interface BarData {
    value: number;
    label?: string;
    frontColor?: string;
    spacing?: number;
    labelWidth?: number;
    labelTextStyle?: TextStyle;
  }

  export interface LineData {
    value: number;
    label?: string;
    dataPointRadius?: number;
    dataPointColor?: string;
    dataPointStrokeColor?: string;
    dataPointStrokeWidth?: number;
    labelTextStyle?: TextStyle;
  }

  export interface BarChartProps {
    data: BarData[];
    yAxisLabelTexts?: string[];
    initialSpacing?: number;
    endSpacing?: number;
    disableScroll?: boolean;
    height?: number;
    barWidth?: number;
    spacing?: number;
    barBorderRadius?: number;
    hideRules?: boolean;
    rulesColor?: string;
    rulesType?: 'solid' | 'dashed' | 'dotted';
    xAxisThickness?: number;
    yAxisThickness?: number;
    yAxisTextStyle?: TextStyle;
    xAxisLabelTextStyle?: TextStyle;
    hideYAxisText?: boolean;
    noOfSections?: number;
    maxValue?: number;
    backgroundColor?: string;
    disablePress?: boolean;
    isAnimated?: boolean;
  }

  export interface LineChartProps {
    data: LineData[];
    data2?: LineData[];
    interpolateMissingValues?: boolean;
    dataPointsColor2?: string;
    yAxisLabelTexts?: string[];
    height?: number;
    spacing?: number;
    initialSpacing?: number;
    endSpacing?: number;
    color?: string;
    color2?: string;
    thickness?: number;
    strokeDashArray2?: number[];
    startFillColor?: string;
    startOpacity?: number;
    endOpacity?: number;
    hideDataPoints?: boolean;
    textColor?: string;
    textFontSize?: number;
    xAxisLabelTextStyle?: TextStyle;
    yAxisTextStyle?: TextStyle;
    yAxisThickness?: number;
    xAxisThickness?: number;
    hideRules?: boolean;
    rulesColor?: string;
    rulesType?: 'solid' | 'dashed' | 'dotted';
    noOfSections?: number;
    maxValue?: number;
    hideYAxisText?: boolean;
    backgroundColor?: string;
    disableScroll?: boolean;
    isAnimated?: boolean;
    curved?: boolean;
  }

  export function BarChart(props: BarChartProps): JSX.Element;
  export function LineChart(props: LineChartProps): JSX.Element;
}
