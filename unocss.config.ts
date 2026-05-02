import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.1,
      cdn: 'https://esm.sh/',
    }),
    presetTypography({
      cssExtend: {
        'ul,ol': {
          'padding-left': '2.25em',
          'position': 'relative',
        },
      },
    }),
  ],
  transformers: [transformerVariantGroup(), transformerDirectives()],
  shortcuts: [{
    'fc': 'flex justify-center',
    'fi': 'flex items-center',
    'fb': 'flex justify-between',
    'fcc': 'fc items-center',
    'fie': 'fi justify-end',
    'col-fcc': 'flex-col fcc',
    'inline-fcc': 'inline-flex items-center justify-center',
    'base-focus': 'focus:(ring-0 outline-none border-[var(--c-primary-active)])',
    'b-slate-link': 'border-b border-(transparent) hover:border-[var(--c-text-secondary)]',
    'gpt-title': 'text-4xl font-400 tracking--0.03em mr-1 text-[var(--c-fg)]',
    'gpt-subtitle': 'text-4xl font-400 tracking--0.03em text-[var(--c-fg)]',
    'gpt-copy-btn': 'absolute top-12px right-12px z-3 fcc border border-[var(--c-border)] w-8 h-8 p-2 rounded-[10px] bg-[var(--c-surface)] text-[var(--c-text-secondary)] op-92 cursor-pointer hover:op-100',
    'gpt-copy-tips': 'op-0 h-7 bg-black px-2.5 py-1 box-border text-xs c-white fcc rounded absolute z-1 transition duration-600 whitespace-nowrap -top-8',
    'gpt-retry-btn': 'fi gap-1 px-3 py-1 border border-[var(--c-border)] rounded-[50px] text-sm text-[var(--c-text-secondary)] cursor-pointer bg-[var(--c-surface)] hover:op-90',
    'gpt-back-top-btn': 'fcc p-2.5 text-base rounded-md hover:bg-slate/10 fixed bottom-60px right-20px z-10 cursor-pointer transition-colors',
    'gpt-back-bottom-btn': 'gpt-back-top-btn bottom-20px transform-rotate-180deg',
    'gpt-password-input': 'px-4 py-3 h-12 rounded-[50px] bg-[var(--c-surface)] border border-[var(--c-border)] text-[var(--c-text-secondary)] base-focus',
    'gpt-password-submit': 'fcc h-12 w-12 rounded-[50px] bg-[var(--c-surface)] border border-[var(--c-border)] text-[var(--c-text-secondary)] cursor-pointer hover:op-90',
    'gen-slate-btn': 'h-12 px-4 py-2 rounded-[50px] bg-[var(--c-surface)] text-[var(--c-text-secondary)] border border-[var(--c-border)] hover:op-90',
    'gen-cb-wrapper': 'h-12 my-4 fcc gap-4 rounded-[50px] bg-[var(--c-surface-veil)] border border-[var(--c-border)] text-[var(--c-text-secondary)]',
    'gen-cb-stop': 'px-3 py-1 border border-[var(--c-border)] rounded-[50px] text-sm text-[var(--c-text-secondary)] cursor-pointer hover:op-90',
    'gen-text-wrapper': 'my-4 fc gap-2 transition-opacity',
    'gen-textarea': 'w-full px-4 py-3 min-h-12 max-h-36 rounded-[50px] bg-[var(--c-surface)] border border-[var(--c-border)] resize-none text-[var(--c-text-secondary)] base-focus placeholder:text-[var(--c-text-muted)] scroll-pa-8px pl-10',
    'sys-edit-btn': 'inline-fcc gap-1 text-sm bg-[var(--c-surface-veil)] border border-[var(--c-border)] px-2 py-1 rounded-[10px] text-[var(--c-text-secondary)] transition-colors cursor-pointer hover:op-90',
    'stick-btn-on': '!bg-$c-fg text-$c-bg hover:op-80',
  }],
})
