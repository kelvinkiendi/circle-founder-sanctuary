import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Layout, PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Download, RefreshCw, Send, CheckCircle2, XCircle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  computePaymentAmount,
  initiateMpesaStkPush,
  updatePaymentStatus,
  retryPayment,
  getPaymentSummary,
  getOutstandingInstallments,
  runSuspensionSweep,
} from "@/lib/payments.functions";

