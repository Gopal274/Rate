
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
import { reconcileLedgers, type ReconciliationData } from '@/ai/flows/reconcile-ledgers-flow';
import { writeToSheetAction } from '@/lib/actions';
import { Loader, Upload, FileText, CheckCircle, ExternalLink, Bot, Table } from 'lucide-react';
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

type ProcessingState = 'idle' | 'analyzing' | 'writing_sheet' | 'done' | 'error';


export default function ClientReconciliationPage() {
  const [partyAPdf, setPartyAPdf] = useState<File | null>(null);
  const [partyBPdf, setPartyBPdf] = useState<File | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { auth } = useFirebase();
  const { user } = useUser();


  const handleReset = () => {
    setPartyAPdf(null);
    setPartyBPdf(null);
    setProcessingState('idle');
    setResultUrl(null);
    setErrorMessage(null);
  }

  const handleSubmit = async () => {
    if (!user || !auth || !partyAPdf || !partyBPdf) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please sign in and select both PDF files.' });
        return;
    }
    
    setProcessingState('analyzing');
    setResultUrl(null);
    setErrorMessage(null);
    
    try {
        // Step 1: AI Analysis
        toast({ title: 'Step 1: Analyzing Ledgers...', description: 'The AI is comparing the documents. This may take a moment.' });
        
        const [partyADataUri, partyBDataUri] = await Promise.all([
            fileToDataURI(partyAPdf),
            fileToDataURI(partyBPdf)
        ]);

        const jsonData = await reconcileLedgers({
            partyALedgerPdf: partyADataUri,
            partyBLedgerPdf: partyBDataUri,
        });

        // Step 2: Get fresh auth token and write to sheet
        setProcessingState('writing_sheet');
        toast({ title: 'Step 2: Writing to Google Sheet...', description: 'AI analysis complete. Now creating your report.' });

        let accessToken;
        try {
            const provider = new GoogleAuthProvider();
            provider.addScope('https://www.googleapis.com/auth/drive.file');
            provider.addScope('https://www.googleapis.com/auth/spreadsheets');
            
            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            accessToken = credential?.accessToken;

            if (!accessToken) {
                throw new Error("Could not retrieve a fresh access token from Google.");
            }
        } catch (authError: any) {
             if (authError.code === 'auth/popup-blocked') {
                throw new Error("Popup blocked by browser. Please allow popups for this site and try again.");
            } else {
                throw new Error("Google Authentication failed. Please try again.");
            }
        }


        const sheetResult = await writeToSheetAction(accessToken, jsonData);

        if (sheetResult.success && sheetResult.sheetUrl) {
            setResultUrl(sheetResult.sheetUrl);
            setProcessingState('done');
            toast({ title: 'Success!', description: 'Ledger reconciliation is complete.' });
        } else {
            throw new Error(sheetResult.message || 'An unknown error occurred while creating the Google Sheet.');
        }

    } catch (error: any) {
        console.error("Reconciliation Error:", error);
        setErrorMessage(error.message || 'Failed to process ledgers.');
        setProcessingState('error');
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to process ledgers.' });
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
  
  const isProcessing = processingState === 'analyzing' || processingState === 'writing_sheet';

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
            {processingState === 'idle' && (
                 <Button onClick={handleSubmit} disabled={!partyAPdf || !partyBPdf || !user}>
                    Reconcile Ledgers
                </Button>
            )}

            {isProcessing && (
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-secondary/50 text-center">
                    <div className="flex items-center text-primary font-semibold">
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                         {processingState === 'analyzing' ? 'Step 1 of 2: AI Analyzing Documents...' : 'Step 2 of 2: Creating Google Sheet...'}
                    </div>
                     <p className="text-sm text-muted-foreground mt-2">This may take up to a minute. Please don't close this page.</p>
                </div>
            )}
           
            {processingState === 'done' && resultUrl && (
                <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/20 space-y-4">
                    <div className="flex items-center">
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
                     <Button onClick={handleReset} variant="secondary" className="w-full">Start New Reconciliation</Button>
                </div>
            )}
            
            {processingState === 'error' && (
                 <div className="p-4 border rounded-lg bg-destructive/10 text-destructive space-y-4">
                    <p className="font-semibold text-center">An Error Occurred</p>
                    <p className="text-sm border bg-background/50 p-2 rounded-md">{errorMessage}</p>
                    <Button onClick={handleReset} variant="destructive" className="w-full">Try Again</Button>
                 </div>
            )}
        </CardFooter>
      </Card>
    </div>
  );
}
