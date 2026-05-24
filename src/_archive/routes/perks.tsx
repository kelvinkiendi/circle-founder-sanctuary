import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, AlertTriangle, Trophy, Sparkles, Bell, Clock, Plane, Cake, Wrench, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Layout, PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

