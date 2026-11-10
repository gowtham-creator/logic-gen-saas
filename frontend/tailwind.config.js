/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{js,ts,jsx,tsx,mdx}',
		'./components/**/*.{js,ts,jsx,tsx,mdx}',
		'./app/**/*.{js,ts,jsx,tsx,mdx}',
	],
	theme: {
		extend: {
			colors: {
				primary: {
					'50': 'var(--color-primary-50, #eff6ff)',
					'100': 'var(--color-primary-100, #dbeafe)',
					'200': 'var(--color-primary-200, #bfdbfe)',
					'300': 'var(--color-primary-300, #93c5fd)',
					'400': 'var(--color-primary-400, #60a5fa)',
					'500': 'var(--color-primary, #3b82f6)',
					'600': 'var(--color-primary-600, #2563eb)',
					'700': 'var(--color-primary-700, #1d4ed8)',
					'800': 'var(--color-primary-800, #1e40af)',
					'900': 'var(--color-primary-900, #1e3a8a)',
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					'50': 'var(--color-secondary-50, #faf5ff)',
					'100': 'var(--color-secondary-100, #f3e8ff)',
					'200': 'var(--color-secondary-200, #e9d5ff)',
					'300': 'var(--color-secondary-300, #d8b4fe)',
					'400': 'var(--color-secondary-400, #c084fc)',
					'500': 'var(--color-secondary, #a855f7)',
					'600': 'var(--color-secondary-600, #9333ea)',
					'700': 'var(--color-secondary-700, #7e22ce)',
					'800': 'var(--color-secondary-800, #6b21a8)',
					'900': 'var(--color-secondary-900, #581c87)',
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				accent: {
					'50': 'var(--color-accent-50, #ecfdf5)',
					'100': 'var(--color-accent-100, #d1fae5)',
					'200': 'var(--color-accent-200, #a7f3d0)',
					'300': 'var(--color-accent-300, #6ee7b7)',
					'400': 'var(--color-accent-400, #34d399)',
					'500': 'var(--color-accent, #10b981)',
					'600': 'var(--color-accent-600, #059669)',
					'700': 'var(--color-accent-700, #047857)',
					'800': 'var(--color-accent-800, #065f46)',
					'900': 'var(--color-accent-900, #064e3b)',
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))'
				}
			},
			fontFamily: {
				sans: [
					'Satoshi',
					'-apple-system',
					'BlinkMacSystemFont',
					'Segoe UI',
					'Roboto',
					'Oxygen',
					'Ubuntu',
					'Cantarell',
					'Fira Sans',
					'Droid Sans',
					'Helvetica Neue',
					'sans-serif'
				]
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
}

