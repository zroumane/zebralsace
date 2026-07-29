import type { GlobalThemeOverrides } from 'naive-ui'

export const ROUGE = '#C1121F'
export const ROUGE_FONCE = '#780000'

export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: ROUGE,
    primaryColorHover: '#A50F1A',
    primaryColorPressed: ROUGE_FONCE,
    primaryColorSuppl: ROUGE_FONCE,
    textColorBase: '#1C1C1C',
    bodyColor: '#FFFFFF',
    fontFamily: "'Roboto', sans-serif",
    borderRadius: '6px',
  },
}
