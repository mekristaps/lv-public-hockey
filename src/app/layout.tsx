import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";

import { UserProvider } from "@/context/UserContext";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getUserProfile } from "@/lib/actions/profiles";

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
};

interface RootLayoutProps {
	children: React.ReactNode;
}

// 2. Make the function 'async'
export default async function RootLayout({ children }: RootLayoutProps) {
	const cookieStore = await cookies();
    const userId = cookieStore.get("hokejs_user_id")?.value;
	let profile = null;

	if (userId) {
		profile = await getUserProfile(userId);
	}

	return (
		<html lang="en" dir="ltr">
			<body className={`${geistSans.variable} ${geistMono.variable} relative antialiased`} >
				<UserProvider initialProfile={profile}>
					{children}
				</UserProvider>
			</body>
		</html>
	);
}
