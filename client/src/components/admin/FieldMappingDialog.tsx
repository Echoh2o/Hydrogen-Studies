import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ColumnMapping {
  excelColumn: string;
  dbField: string;
}

interface FieldMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnMappings: ColumnMapping[];
  onUpdateMapping: (excelColumn: string, dbField: string) => void;
  onSave: () => void;
  onCancel: () => void;
  dbFields: { value: string; label: string }[];
}

export default function FieldMappingDialog({
  open,
  onOpenChange,
  columnMappings,
  onUpdateMapping,
  onSave,
  onCancel,
  dbFields
}: FieldMappingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Map Excel Columns to Database Fields</DialogTitle>
          <DialogDescription>
            Select where each column from your file should be imported in the database.
            Choose "Do not import this column" for any columns you want to skip.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[50vh] mt-4">
          <div className="space-y-4 pr-4">
            {columnMappings.map((mapping, index) => (
              <div key={index} className="grid grid-cols-2 gap-4 items-center pb-2 border-b">
                <div>
                  <Label className="text-sm font-medium">{mapping.excelColumn}</Label>
                  <p className="text-xs text-muted-foreground">Excel Column</p>
                </div>
                <div>
                  <Select
                    value={mapping.dbField}
                    onValueChange={(value) => onUpdateMapping(mapping.excelColumn, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Do not import this column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__SKIP__">Do not import this column</SelectItem>
                      {dbFields.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSave}>
            Save Mappings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}