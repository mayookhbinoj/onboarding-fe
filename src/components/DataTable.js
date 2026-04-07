import React, { useState, useMemo, useCallback } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Search, ChevronUp, ChevronDown, ArrowUpDown, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Shared DataTable component — configurable, sortable, searchable, paginated.
 *
 * @param {Object} props
 * @param {Array} props.columns - Column definitions [{key, label, sortable?, render?, width?}]
 * @param {Array} props.data - Row data array
 * @param {boolean} props.loading - Show skeleton state
 * @param {string} props.emptyMessage - Message when no data
 * @param {Function} props.onRowClick - (row) => void
 * @param {Array} props.searchFields - Fields to search across
 * @param {string} props.searchPlaceholder - Search input placeholder
 * @param {Array} props.statusOptions - [{value, label}] for status filter
 * @param {string} props.statusField - Field name for status filter
 * @param {boolean} props.selectable - Enable row checkboxes
 * @param {Array} props.bulkActions - [{label, onClick, variant}]
 * @param {boolean} props.exportable - Show CSV export button
 * @param {string} props.exportFilename - CSV filename
 * @param {Function} props.onRefresh - Refresh handler
 * @param {number} props.pageSize - Items per page (default 50)
 * @param {number} props.totalItems - Total for server-side pagination
 * @param {number} props.currentPage - Current page (1-indexed)
 * @param {Function} props.onPageChange - (page) => void for server-side
 * @param {string} props.className - Additional wrapper classes
 * @param {string} props.testId - data-testid for testing
 */
export default function DataTable({
  columns = [], data = [], loading = false, emptyMessage = 'No data found',
  onRowClick, searchFields = [], searchPlaceholder = 'Search...',
  statusOptions, statusField, selectable = false, bulkActions = [],
  exportable = false, exportFilename = 'export', onRefresh,
  pageSize = 50, totalItems, currentPage, onPageChange,
  className = '', testId = 'data-table',
  // Card mode
  renderMode = 'table', renderCard, cardColumns = 3,
  // Expandable
  expandable = false, renderExpanded, multiExpand = false,
  // Row styling
  rowClassName,
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [localPage, setLocalPage] = useState(1);
  const [expanded, setExpanded] = useState(multiExpand ? new Set() : null);

  // Debounce search
  const searchTimer = React.useRef(null);
  const handleSearch = useCallback((val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(val), 300);
  }, []);

  // Helper to get nested field value (supports dot notation like 'tracking.associate_name')
  const getNestedValue = (obj, path) => {
    if (!path.includes('.')) return obj[path];
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  };

  // Client-side filtering + sorting (when no server-side pagination)
  const isServerPaginated = onPageChange !== undefined;
  const filtered = useMemo(() => {
    if (isServerPaginated) return data; // Server handles filtering
    let result = [...data];
    // Search filter
    if (debouncedSearch && searchFields.length) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(row => searchFields.some(f => String(getNestedValue(row, f) || '').toLowerCase().includes(q)));
    }
    // Status filter
    if (statusFilter !== 'all' && statusField) {
      result = result.filter(row => String(row[statusField]).toLowerCase() === statusFilter.toLowerCase());
    }
    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        const av = a[sortKey] ?? '', bv = b[sortKey] ?? '';
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [data, debouncedSearch, searchFields, statusFilter, statusField, sortKey, sortDir, isServerPaginated]);

  // Client-side pagination
  const page = isServerPaginated ? currentPage : localPage;
  const total = isServerPaginated ? totalItems : filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageData = isServerPaginated ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);
  const goPage = isServerPaginated ? onPageChange : setLocalPage;

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const toggleSelect = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(prev => prev.size === pageData.length ? new Set() : new Set(pageData.map(r => r._id || r.id)));

  const exportCSV = () => {
    const headers = columns.map(c => c.label).join(',');
    const rows = filtered.map(row => columns.map(c => `"${String(row[c.key] || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${exportFilename}.csv`; a.click();
  };

  return (
    <div className={className} data-testid={testId}>
      {/* Toolbar */}
      {(searchFields.length > 0 || statusOptions || exportable || onRefresh) && (
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center mb-3">
          {searchFields.length > 0 && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => handleSearch(e.target.value)} placeholder={searchPlaceholder} className="pl-9 h-9" data-testid={`${testId}-search`} />
            </div>
          )}
          {statusOptions && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9 text-xs" data-testid={`${testId}-status-filter`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-1.5 ml-auto">
            {exportable && <Button variant="outline" size="sm" onClick={exportCSV} className="h-9 gap-1 text-xs"><Download className="w-3.5 h-3.5" /> CSV</Button>}
            {onRefresh && <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="h-9 w-9 p-0"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></Button>}
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selectable && selected.size > 0 && bulkActions.length > 0 && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
          <span className="text-xs font-medium">{selected.size} selected</span>
          {bulkActions.map(a => <Button key={a.label} size="sm" variant={a.variant || 'outline'} className="h-7 text-xs" onClick={() => a.onClick([...selected])}>{a.label}</Button>)}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {/* Content — table or card mode */}
      {renderMode === 'cards' ? (
        // ── Card Mode ──
        <div>
          {loading ? (
            <div className={`grid gap-3 grid-cols-1 ${cardColumns >= 3 ? 'md:grid-cols-2 lg:grid-cols-3' : cardColumns === 2 ? 'md:grid-cols-2' : ''}`}>
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : pageData.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs border-2 border-dashed rounded-xl">{emptyMessage}</div>
          ) : (
            <div className={`grid gap-3 grid-cols-1 ${cardColumns >= 3 ? 'md:grid-cols-2 lg:grid-cols-3' : cardColumns === 2 ? 'md:grid-cols-2' : ''}`}>
              {pageData.map((row, idx) => {
                const rowId = row._id || row.id || idx;
                const isExpanded = multiExpand ? expanded?.has(rowId) : expanded === rowId;
                return (
                  <div key={rowId} data-testid={`${testId}-card-${idx}`}>
                    <div onClick={() => {
                      if (expandable) {
                        if (multiExpand) setExpanded(prev => { const n = new Set(prev); n.has(rowId) ? n.delete(rowId) : n.add(rowId); return n; });
                        else setExpanded(prev => prev === rowId ? null : rowId);
                      } else if (onRowClick) onRowClick(row);
                    }} className={expandable || onRowClick ? 'cursor-pointer' : ''}>
                      {renderCard ? renderCard(row, idx, isExpanded) : (
                        <div className="p-3 border rounded-xl hover:shadow-sm transition-shadow">
                          {columns.map(col => <div key={col.key} className="text-xs"><span className="text-muted-foreground">{col.label}: </span>{col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '-')}</div>)}
                        </div>
                      )}
                    </div>
                    {expandable && isExpanded && renderExpanded && (
                      <div className="mt-1 animate-in fade-in slide-in-from-top-1 duration-200">{renderExpanded(row)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        // ── Table Mode ──
        <div className="border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {selectable && <th className="w-10 px-3 py-2"><Checkbox checked={selected.size === pageData.length && pageData.length > 0} onCheckedChange={toggleAll} /></th>}
                  {columns.map(col => (
                    <th key={col.key} className={`px-3 py-2 text-left text-xs font-medium text-muted-foreground ${col.sortable !== false ? 'cursor-pointer hover:text-foreground select-none' : ''}`} style={col.width ? { width: col.width } : {}} onClick={() => col.sortable !== false && toggleSort(col.key)}>
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {col.sortable !== false && (sortKey === col.key ? (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b"><td colSpan={columns.length + (selectable ? 1 : 0)} className="px-3 py-3"><div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} /></td></tr>
                  ))
                ) : pageData.length === 0 ? (
                  <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="px-3 py-8 text-center text-muted-foreground text-xs">{emptyMessage}</td></tr>
                ) : (
                  pageData.map((row, idx) => {
                    const rowId = row._id || row.id || idx;
                    const isExpanded = multiExpand ? expanded?.has(rowId) : expanded === rowId;
                    return (
                      <React.Fragment key={rowId}>
                        <tr className={`border-b hover:bg-muted/20 transition-colors ${onRowClick || expandable ? 'cursor-pointer' : ''} ${selected.has(rowId) ? 'bg-primary/5' : ''} ${rowClassName ? rowClassName(row) : ''}`} onClick={() => { if (expandable) { if (multiExpand) setExpanded(prev => { const n = new Set(prev); n.has(rowId) ? n.delete(rowId) : n.add(rowId); return n; }); else setExpanded(prev => prev === rowId ? null : rowId); } else if (onRowClick) onRowClick(row); }} data-testid={`${testId}-row-${idx}`}>
                          {selectable && <td className="px-3 py-2" onClick={e => e.stopPropagation()}><Checkbox checked={selected.has(rowId)} onCheckedChange={() => toggleSelect(rowId)} /></td>}
                          {columns.map(col => (
                            <td key={col.key} className="px-3 py-2 text-xs">{col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '-')}</td>
                          ))}
                        </tr>
                        {expandable && isExpanded && renderExpanded && (
                          <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="p-0"><div className="border-b bg-muted/10 animate-in fade-in slide-in-from-top-1 duration-200">{renderExpanded(row)}</div></td></tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between px-3 py-2 border rounded-xl bg-muted/10 text-xs text-muted-foreground mt-2">
          <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => goPage(page - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
            <span className="px-2">Page {page} of {totalPages}</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => goPage(page + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
