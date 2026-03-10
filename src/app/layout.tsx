import type { Metadata, Viewport } from "next";
import { SerwistProvider } from "./serwist";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const APP_NAME = "MS Hokejs";
const APP_DEFAULT_TITLE = "MS Hokejs";
const APP_TITLE_TEMPLATE = "%s - MS Nūjas";
const APP_DESCRIPTION = "Masu slidotava ar nūjām saraksts & pieteikšanās";

export const metadata: Metadata = {
	applicationName: APP_NAME,
	title: {
		default: APP_DEFAULT_TITLE,
		template: APP_TITLE_TEMPLATE,
	},
	description: APP_DESCRIPTION,
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: APP_DEFAULT_TITLE,
		// startUpImage: [],
	},
	formatDetection: {
		telephone: false,
	},
	openGraph: {
		type: "website",
		siteName: APP_NAME,
		title: {
			default: APP_DEFAULT_TITLE,
			template: APP_TITLE_TEMPLATE,
		},
		description: APP_DESCRIPTION,
	},
	twitter: {
		card: "summary",
		title: {
			default: APP_DEFAULT_TITLE,
			template: APP_TITLE_TEMPLATE,
		},
		description: APP_DESCRIPTION,
	},
	manifest: "/manifest.json",
	themeColor: "#0F172A",
	viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0",
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
};

interface RootLayoutProps {
	children: React.ReactNode;
}

// 2. Make the function 'async'
export default async function RootLayout({ children }: RootLayoutProps) {
	// 3. Initialize Supabase and check for user
	//const supabase = await createClient();

	return (
		<html lang="en" dir="ltr">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<SerwistProvider swUrl="/serwist">{children}</SerwistProvider>
			</body>
		</html>
	);
}
