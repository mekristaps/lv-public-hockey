'use client'

import { useEffect, useState, useActionState } from 'react';

import { UserProfile, profileAction, requestPinHelpAction } from '@/lib/actions/profiles';
import { useUser } from '@/context/UserContext';
import { sendWhatsAppMessage } from '@/utils/whatsapp';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, UserPlus, LogIn, ChevronLeft, AlertCircle } from "lucide-react";

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
    const [resetPin, setResetPin] = useState<boolean>(false);
    const [isHelpSent, setIsHelpSent] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [currentPhone, setCurrentPhone] = useState<string>(profile ? profile.phone_number : '');
    
    const { setProfile } = useUser();

    const initialFormValues: FormFields = {
        phone: profile?.phone_number || "",
        full_name: profile?.full_name || "",
    };

    const isPhoneChanged = currentPhone !== initialFormValues.phone && initialFormValues.phone !== "";

    const [formState, formAction, isPending] = useActionState(profileAction, initialFormValues);
    const error = formState?.error;

    const handleRequestHelp = async () => {
        const { phone, pin } = formState?.failedAttempt || {};
        setIsLoading(true);

        try {
            const response = await requestPinHelpAction(phone, pin);
            if (response.success) {
                setIsHelpSent(true);
                localStorage.setItem('hokejs_last_pin_request', Date.now().toString());
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

    const toggleMode = (mode: modes) => {
        modeChange(mode);
        setMode(mode);
    };

    useEffect(() => {
        
        const checkPinRequestStatus = () => {
            const lastRequest = localStorage.getItem('hokejs_last_pin_request');
            
            if (!lastRequest) return { exists: false };
            setIsHelpSent(true);
        };
        
        if (formState?.success) {

            // 2. If a PIN was generated (New Register/Reset), trigger the WhatsApp flow
            if (formState.generatedPin && formState?.type === 'register') {
                sendWhatsAppMessage(formState.phone, formState.generatedPin);
                // Note: On iPhone, the redirect below might happen before WhatsApp opens.
                // You might want to skip the redirect here and let the WhatsApp button handle it.
            } else if (formState?.type === 'update' && formState.updatedProfile) {
                setProfile(formState.updatedProfile);

                if (formState.phoneChanged) {
                    sendWhatsAppMessage(formState.newUserData.phone_number, formState.newUserData.pin_code);
                }
                
                window.location.href = "/"; 
            } else if (formState?.type === 'login') {
                // 3. If it was a standard Login (no new PIN generated), just go home
                // set user profile after login
                localStorage.removeItem('hokejs_last_pin_request');
                setIsHelpSent(false);
                window.location.href = "/"; 
            } else if (formState?.type === 'pin_reset') {
                
                setIsHelpSent(true);
            } else {
                window.location.href = "/"; 
            }
        } else if (!formState?.success) {

            if (formState.errorType === 'wrong_pin') {
                setResetPin(true);
            }
        }

        checkPinRequestStatus();

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
                    <input type="hidden" name="old_pin" value={profile.pin_code} autoComplete="off" autoCorrect="off" spellCheck="false"/>
                    <input type="hidden" name="old_phone" value={profile.phone_number} autoComplete="off" autoCorrect="off" spellCheck="false" />
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
                        autoComplete="off" 
                        autoCorrect="off" 
                        spellCheck="false"
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
                        onChange={(e) => setCurrentPhone(e.target.value)}
                        className="h-10"
                        autoComplete="one-time-code"
                        autoCorrect="off" 
                        spellCheck="false"
                        required
                    />
                    {(profile && isPhoneChanged) && (
                        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 animate-in fade-in slide-in-from-top-1">
                            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                            <div className="text-xs text-amber-800 leading-relaxed">
                                <strong>Uzmanību:</strong> Mainot telefona numuru, Jums tiks nosūtīts jauns PIN kods uz WhatsApp drošības nolūkos.
                            </div>
                        </div>
                    )}
                    {/* PIN FIELD: Show in Login or Edit mode */}
                    {(mode === 'login') && (
                        <div className="relative">
                            <Input
                                placeholder={profile ? "Mainīt PIN" : "Ievadiet savu PIN"}
                                name="pin_code"
                                id="pin_code"
                                type="password"
                                inputMode="numeric"
                                className="h-10 pl-9"
                                autoComplete="new-password" 
                                autoCorrect="off" 
                                spellCheck="false"
                                required={mode === 'login'}
                            />
                            <Lock className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                        </div>
                    )}
                </div>
            </div>

            {/* Error Message & PIN Recovery */}
            {resetPin && !isHelpSent && (
                <div className="p-3 border border-amber-200 bg-amber-50 rounded-lg">
                    <p className="text-[11px] text-amber-800 mb-2">Aizmirsi savu PIN?</p>
                    <Button 
                        disabled={isLoading}
                        type="button"
                        variant="outline" 
                        size="sm" 
                        className="w-full bg-white border-amber-300 h-8 text-xs text-amber-700"
                        onClick={(e) => {
                            e.preventDefault(); // Prevent form submission
                            handleRequestHelp();
                        }}
                    >
                        {isLoading ? "Apstrādā..." : "Pieprasīt jaunu PIN"}
                    </Button>
                </div>
            )}

            {isHelpSent && (
                <div className="p-3 border border-emerald-200 bg-emerald-50 rounded-lg animate-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 mb-1">
                        {/* Success Checkmark */}
                        <div className="flex items-center justify-center w-4 h-4 bg-emerald-500 rounded-full">
                            <svg 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                className="w-3 h-3 text-white stroke-[3]" 
                                stroke="currentColor"
                            >
                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <p className="text-[11px] text-emerald-800 font-bold">Pieprasījums veiksmīgs!</p>
                    </div>
                    <p className="text-[10px] text-emerald-700 leading-tight">
                        Jauns PIN ir izveidots. Administrators to tūlīt nosūtīs uz Jūsu WhatsApp. 
                        Lūdzu, gaidiet ziņu.
                    </p>
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