'use client'

import { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '@/lib/actions/profiles';

interface UserContextType {
    profile: UserProfile | null;
    setProfile: (profile: UserProfile | null) => void;
    isLoading: boolean;
}

interface UserProviderProps { 
    children: React.ReactNode, 
    initialProfile: UserProfile | null 
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children, initialProfile}: UserProviderProps) {
    const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
    const [isLoading, setIsLOading] = useState<boolean>(true);

    useEffect(() => {
        if (!profile) {
            const saved = localStorage.getItem('hokejs_user_session');
            if (saved) {
                setProfile(JSON.parse(saved));
            }
        }
        setIsLOading(false);
    }, [profile]);

    const updateProfile = (newProfile: UserProfile | null) => {
        setProfile(newProfile);
        if (newProfile) {
            localStorage.setItem('hokejs_user_session', JSON.stringify(newProfile));
        } else {
            localStorage.removeItem('hokejs_user_session');
        }
    };

    return (
        <UserContext value={{ profile, setProfile: updateProfile, isLoading }}>
            {children}
        </UserContext>
    );
}

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within UserProvider');
    }

    return context;
};