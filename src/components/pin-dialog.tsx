import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Copy, CheckCircle2 } from "lucide-react"
import { useState } from "react"

interface PinDialogProps {
    pin: string;
    onOpenChange?: () => void;
    onContinue: () => void;
    title: string;
}

export function PinDialog({ 
    pin,
    onOpenChange, 
    onContinue,
    title
}: PinDialogProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader className="flex flex-col items-center justify-center text-center">
                <div className="mb-4 rounded-full bg-green-100 p-3 text-green-600">
                    <CheckCircle2 className="h-10 w-10" />
                </div>
                <DialogTitle className="text-2xl">
                    {title}
                </DialogTitle>
                <DialogDescription>
                    Saglabā šo PIN kodu, lai pieteiktos savā profilā.
                </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center space-y-4 py-4">
                <div className="relative flex items-center justify-center rounded-lg bg-muted px-8 py-6 border-2 border-dashed">
                    <span className="text-5xl font-mono font-bold tracking-[0.3em] text-primary ml-4">
                        {pin}
                    </span>
                </div>
          
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2" 
                    onClick={copyToClipboard}
                >
                    {copied ? "Nokopēts!" : "Nokopēt kodu"}
                    <Copy className="h-4 w-4" />
                </Button>
            </div>

            <DialogFooter>
                <Button className="w-full" size="lg" onClick={onContinue}>
                    Turpināt uz pieteikšanos
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  )
}