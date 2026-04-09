'use client'

import { useEffect, useState, useActionState } from 'react';

import { UserProfile, profileAction, requestPinHelpAction } from '@/lib/actions/profiles';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, UserPlus, LogIn, ChevronLeft } from "lucide-react";

import { Loader } from './loader';

type modes = 'login' | 'register' | 'edit' | 'main' | null;

interface FormFields {
    phone: string;
    full_name: string;
}

interface UserFormProps {
    profile: UserProfile | null;
    modeChange: (mode: modes) => void;
}

export function UserForm({ profile, modeChange }: UserFormProps) {
    const [mode, setMode] = useState<modes>(profile ? 'edit' : null);
    const [isHelpSent, setIsHelpSent] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const initialFormValues: FormFields = {
        phone: profile?.phone_number || "",
        full_name: profile?.full_name || "",
    };

    const [formState, formAction, isPending] = useActionState(profileAction, initialFormValues);
    const error = formState?.error;

    const handleRequestHelp = async () => {
        const { phone, name, pin } = formState?.failedAttempt || {};
        setIsLoading(true);

        try {
            const response = await requestPinHelpAction(phone, name, pin);
            if (response.success) {
                setIsHelpSent(true);
            } else {
               console.error("Failed to send help request:", response?.error);
            }
        } catch (error) {
            console.error("Failed to send help request:", error);
        } finally {
            setTimeout(() => {
				setIsLoading(false);
			}, 1000);
        }
    };

    const sendWhatsAppMessage = (phone: string, pin: string) => {
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length === 8) cleanPhone = '371' + cleanPhone;
        const currentURL = window.location.href;
        const msg = `Masu hokeja lietotnes PIN: ${pin}, ${currentURL}`;
        const encodedMsg = encodeURIComponent(msg);
        window.location.href = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
    }

    const toggleMode = (mode: modes) => {
        modeChange(mode);
        setMode(mode);
    };

    useEffect(() => {
        if (formState?.success) {
        
            // 2. If a PIN was generated (New Register/Reset), trigger the WhatsApp flow
            if (formState.generatedPin) {
                sendWhatsAppMessage(formState.phone, formState.generatedPin);
                // Note: On iPhone, the redirect below might happen before WhatsApp opens.
                // You might want to skip the redirect here and let the WhatsApp button handle it.
            } else if (formState.updatedProfile) {
                sendWhatsAppMessage(formState.newUserData.phone_number, formState.newUserData.pin_code);
                window.location.href = "/"; 
            } else {
                // 3. If it was a standard Login (no new PIN generated), just go home
                // set user profile after login
                window.location.href = "/"; 
            }
        }
    }, [formState, profile]);

    if (isLoading || isPending) {
        return <Loader message="Ielādē datus" />
    }

    // login or register
    if (!profile && mode === null) {
        return (
            <div className="grid grid-cols-2 gap-4 py-4">
                <Button 
                    variant="outline" 
                    className="flex flex-col h-24 gap-2 border-2 hover:border-primary hover:bg-primary/5"
                    onClick={() => toggleMode('login')}
                >
                    <LogIn className="w-6 h-6" />
                    <span>Pieslēgties</span>
                </Button>
                <Button 
                    variant="outline" 
                    className="flex flex-col h-24 gap-2 border-2 hover:border-primary hover:bg-primary/5"
                    onClick={() => toggleMode('register')}
                >
                    <UserPlus className="w-6 h-6" />
                    <span>Reģistrēties</span>
                </Button>
            </div>
        );
    }

    return (
        <form action={formAction} className="space-y-2">
            {!profile && (
                <div className='flex items-center'>
                    <Button 
                        variant='ghost'
                        type="button" 
                        onClick={() => toggleMode(null)}
                        className="w-full h-10 font-bold"
                    >
                        <ChevronLeft className="w-3 h-3 mr-1" /> 
                        Atpakaļ
                    </Button>
                </div>
            )}
            
            <input type="hidden" name="mode" value={mode ? mode : 'register'} />
            {profile && (
                <>
                    <input type="hidden" name="old_pin" value={profile.pin_code} />
                    <input type="hidden" name="old_phone" value={profile.phone_number} />
                </>
            )}
            <div className="space-y-2">
                {/* NAME FIELD: Only show in Register or Edit mode */}
                {(mode === 'register' || mode === 'edit') && (
                    <Input
                        placeholder="Vārds Uzvārds"
                        name="full_name"
                        id="full_name"
                        defaultValue={initialFormValues.full_name}
                        className="h-10"
                        required
                    />
                )}
                <div className="flex flex-col gap-2">
                    {/* PHONE FIELD: Show in all modes */}
                    <Input
                        placeholder="Telefona numurs"
                        type="tel"
                        name="phone"
                        id="phone"
                        defaultValue={initialFormValues.phone}
                        className="h-10"
                        required
                    />
                    {/* PIN FIELD: Show in Login or Edit mode */}
                    {(mode === 'login' || mode === 'edit') && (
                        <div className="relative">
                            <Input
                                placeholder={profile ? "Mainīt PIN" : "Ievadiet savu PIN"}
                                name="pin_code"
                                id="pin_code"
                                type="password"
                                inputMode="numeric"
                                className="h-10 pl-9"
                                required={mode === 'login'}
                            />
                            <Lock className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                        </div>
                    )}
                </div>
            </div>

            {/* Error Message & PIN Recovery */}
            {formState?.errorType === "wrong_pin" && !isHelpSent && (
                <div className="p-3 border border-amber-200 bg-amber-50 rounded-lg">
                    <p className="text-[11px] text-amber-800 mb-2">Aizmirsi savu PIN?</p>
                    <Button 
                        type="button"
                        variant="outline" 
                        size="sm" 
                        className="w-full bg-white border-amber-300 h-8 text-xs text-amber-700"
                        // onClick={(e) => {
                        //     e.preventDefault(); // Prevent form submission
                        //     handleRequestHelp();
                        // }}
                    >
                        Saņemt jaunu PIN WhatsApp
                    </Button>
                </div>
            )}

            <div className="pt-2">
                <Button 
                    className="w-full h-10 font-bold"
                >
                    {mode === 'register' ? "Izveidot un saņemt PIN" : 
                     mode === 'login' ? "Pieslēgties" : "Saglabāt izmaiņas"}
                </Button>
                
                {mode === 'register' && (
                    <p className="text-[10px] text-center text-muted-foreground mt-2">
                        Pēc reģistrācijas Tev tiks nosūtīts PIN ziņojums WhatsApp.
                    </p>
                )}
            </div>

        </form>
    )
}