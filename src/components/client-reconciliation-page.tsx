
'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { reconcileLedgers } from '@/ai/flows/reconcile-ledgers-flow';
import { Loader, Upload, FileText, CheckCircle, ExternalLink } from 'lucide-react';
import { useFirebase, useUser } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const fileToDataURI = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export default function ClientReconciliationPage() {
  const [partyAPdf, setPartyAPdf] = useState<File | null>(null);
  const [partyBPdf, setPartyBPdf] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { auth } = useFirebase();
  const { user } = useUser();


  const handleAuthAndSubmit = async () => {
    if (!user || !auth) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be signed in.' });
        return;
    }
    
    setIsProcessing(true);
    setResultUrl(null);
    
    try {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/drive.file');
        provider.addScope('https://www.googleapis.com/auth/spreadsheets');
        
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;

        if (!accessToken) {
            throw new Error("Could not retrieve access token from Google.");
        }

        if (!partyAPdf || !partyBPdf) {
            throw new Error("Please upload both ledger PDFs.");
        }

        toast({ title: 'Processing Ledgers...', description: 'The AI is comparing the documents. This may take a moment.' });

        const [partyADataUri, partyBDataUri] = await Promise.all([
            fileToDataURI(partyAPdf),
            fileToDataURI(partyBPdf)
        ]);

        const response = await reconcileLedgers(
            {
                partyALedgerPdf: partyADataUri,
                partyBLedgerPdf: partyBDataUri,
            },
            accessToken // The access token is now passed as a separate argument.
        );

        if (response.sheetUrl) {
            setResultUrl(response.sheetUrl);
            toast({ title: 'Success!', description: 'Ledger reconciliation is complete.' });
        } else {
            throw new Error(response.error || 'An unknown error occurred during reconciliation.');
        }

    } catch (error: any) {
        console.error("Reconciliation Error:", error);
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to process ledgers.' });
    } finally {
        setIsProcessing(false);
    }
  }

  const FileInput = ({
    id,
    label,
    file,
    onFileChange,
    disabled
  }: {
    id: string;
    label: string;
    file: File | null;
    onFileChange: (file: File | null) => void;
    disabled: boolean;
  }) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {file ? (
        <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium truncate">{file.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onFileChange(null)} disabled={disabled}>Change</Button>
        </div>
      ) : (
        <div className="relative">
            <Input id={id} type="file" accept="application/pdf" onChange={(e) => onFileChange(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={disabled} />
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md text-center">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground">PDF only</p>
            </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>AI Ledger Reconciliation</CardTitle>
          <CardDescription>
            Upload two ledger PDFs. The AI will compare them and generate a Google Sheet with matching and discrepant transactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FileInput id="partyA" label="Party A Ledger PDF" file={partyAPdf} onFileChange={setPartyAPdf} disabled={isProcessing}/>
          <FileInput id="partyB" label="Party B Ledger PDF" file={partyBPdf} onFileChange={setPartyBPdf} disabled={isProcessing}/>
        </CardContent>
        <CardFooter className="flex-col items-stretch space-y-4">
            <Button onClick={handleAuthAndSubmit} disabled={!partyAPdf || !partyBPdf || isProcessing}>
                {isProcessing ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Reconciling...</> : 'Reconcile Ledgers'}
            </Button>
            {resultUrl && (
                <div className="flex items-center justify-center p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                    <div className="flex-grow">
                        <p className="font-semibold text-green-800 dark:text-green-300">Reconciliation Complete!</p>
                        <p className="text-sm text-green-700 dark:text-green-400">Your report is ready in Google Sheets.</p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                        <a href={resultUrl} target="_blank" rel="noopener noreferrer">
                            View Sheet <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                    </Button>
                </div>
            )}
        </CardFooter>
      </Card>
    </div>
  );
}
