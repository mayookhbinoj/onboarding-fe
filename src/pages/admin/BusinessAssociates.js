import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Users, Building2 } from 'lucide-react';
import DistributorsList from './DistributorsList';
import HospitalsList from './HospitalsList';

export default function BusinessAssociates() {
  const [tab, setTab] = useState('distributors');

  return (
    <Tabs value={tab} onValueChange={setTab} data-testid="business-associates-tabs" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Business Associates</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage distributors and hospital partners</p>
        </div>
        <TabsList className="self-start">
          <TabsTrigger value="distributors" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Distributors</TabsTrigger>
          <TabsTrigger value="hospitals" className="gap-1.5"><Building2 className="w-3.5 h-3.5" /> Hospitals</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="distributors" className="mt-0">
        <DistributorsList embedded />
      </TabsContent>
      <TabsContent value="hospitals" className="mt-0">
        <HospitalsList embedded />
      </TabsContent>
    </Tabs>
  );
}
