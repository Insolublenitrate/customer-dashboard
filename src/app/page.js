'use client'

import { useState, useEffect } from 'react'
import { 
  Building2, Users, DollarSign, Cpu, 
  Search, ChevronLeft, ChevronRight, Settings2, Send, X, Plus, Edit2
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area, PieChart, Pie, Legend } from 'recharts'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [analyticsData, setAnalyticsData] = useState(null)
  const [territoryData, setTerritoryData] = useState(null)
  const [viewMode, setViewMode] = useState('database') // 'database', 'analytics', 'territories'
  const [leads, setLeads] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  
  // Campaign State
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [campaignResult, setCampaignResult] = useState(null)
  
  // Filters
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [regionalManagerFilter, setRegionalManagerFilter] = useState('')
  const [activeTab, setActiveTab] = useState('all') // 'all', 'with_email', 'high_value'
  
  // Sorting
  const [sortField, setSortField] = useState('id')
  const [sortDir, setSortDir] = useState('DESC')
  
  // Lead Form State
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [formData, setFormData] = useState({
    company: '', contact_name: '', email: '', contact_phone: '',
    city: '', state: '', zip: '', machine_make: '', machine_model: '',
    control: '', product: '', order_value: '', status: 'New', last_contacted: ''
  })
  const [isSaving, setIsSaving] = useState(false)

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value || 0)
  }

  // Fetch initial stats
  const fetchStats = () => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error("Failed to load stats:", err))
  }

  const fetchAnalytics = () => {
    const params = new URLSearchParams({
      search,
      state: stateFilter,
      tabFilter: activeTab,
      statusFilter,
      regionalManager: regionalManagerFilter
    })
    
    fetch(`/api/analytics?${params}`)
      .then(res => res.json())
      .then(data => setAnalyticsData(data))
      .catch(err => console.error("Failed to load analytics:", err))
  }

  useEffect(() => {
    fetchStats()
  }, [])

  // Fetch leads
  const fetchLeads = () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: pagination.page,
      search,
      state: stateFilter,
      tabFilter: activeTab,
      statusFilter,
      regionalManager: regionalManagerFilter,
      sortField,
      sortDir
    })
    
    fetch(`/api/leads?${params}`)
      .then(res => res.json())
      .then(data => {
        setLeads(data.leads || [])
        if (data.pagination) setPagination(data.pagination)
        setLoading(false)
      })
      .catch(err => {
        console.error("Failed to load leads:", err)
        setLoading(false)
      })
  }

  const fetchTerritories = () => {
    fetch('/api/territories')
      .then(res => res.json())
      .then(data => setTerritoryData(data.territories))
      .catch(err => console.error("Failed to load territories:", err))
  }

  useEffect(() => {
    fetchLeads()
    fetchAnalytics()
    if (viewMode === 'territories' && !territoryData) {
      fetchTerritories()
    }
  }, [pagination.page, search, stateFilter, activeTab, statusFilter, regionalManagerFilter, sortField, sortDir, viewMode])

  const handleSearch = (e) => {
    setSearch(e.target.value)
    setPagination(p => ({ ...p, page: 1 }))
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setPagination(p => ({ ...p, page: 1 }))
  }

  const openAddModal = () => {
    setEditingLead(null)
    setFormData({
      company: '', contact_name: '', email: '', contact_phone: '',
      city: '', state: '', zip: '', machine_make: '', machine_model: '',
      control: '', product: '', order_value: '', status: 'New', last_contacted: ''
    })
    setIsLeadModalOpen(true)
  }

  const openEditModal = (lead) => {
    setEditingLead(lead.id)
    setFormData({
      company: lead.company || '', contact_name: lead.contact_name || '', 
      email: lead.email || '', contact_phone: lead.contact_phone || '',
      city: lead.city || '', state: lead.state || '', zip: lead.zip || '', 
      machine_make: lead.machine_make || '', machine_model: lead.machine_model || '',
      control: lead.control || '', product: lead.product || '', 
      order_value: lead.order_value || '', status: lead.status || 'New',
      last_contacted: lead.last_contacted ? new Date(lead.last_contacted).toISOString().split('T')[0] : ''
    })
    setIsLeadModalOpen(true)
  }

  const handleSaveLead = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      const method = editingLead ? 'PUT' : 'POST'
      const payload = { ...formData }
      if (editingLead) payload.id = editingLead
      
      const res = await fetch('/api/leads', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) throw new Error('Failed to save')
      
      setIsLeadModalOpen(false)
      fetchLeads()
      fetchStats()
      fetchAnalytics()
    } catch (err) {
      alert("Error saving lead: " + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = () => {
    const params = new URLSearchParams({
      search, state: stateFilter, tabFilter: activeTab, statusFilter, sortField, sortDir
    });
    window.location.href = `/api/export?${params.toString()}`;
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'ASC' ? 'DESC' : 'ASC')
    } else {
      setSortField(field)
      setSortDir('ASC')
    }
  }

  const renderSortIndicator = (field) => {
    if (sortField !== field) {
      return <span style={{ marginLeft: '4px', fontSize: '0.75rem', opacity: 0.3 }}>↕</span>;
    }
    return <span style={{ marginLeft: '4px', fontSize: '0.75rem', color: '#3b82f6' }}>{sortDir === 'ASC' ? '▲' : '▼'}</span>;
  }

  const getNextAction = (lead) => {
    if (!lead.email || lead.email === 'NOT_FOUND') return { text: 'Find Contact Info', color: '#f59e0b' }
    if (lead.status === 'New') return { text: 'Send Intro', color: '#3b82f6' }
    if (lead.status === 'Contacted') {
      const daysSince = lead.last_contacted ? (new Date() - new Date(lead.last_contacted)) / (1000 * 3600 * 24) : 0;
      if (daysSince > 7) return { text: 'Needs Follow-up', color: '#ef4444' }
      return { text: 'Wait for Reply', color: '#94a3b8' }
    }
    if (lead.status === 'Qualified') return { text: 'Send Proposal', color: '#10b981' }
    if (lead.status === 'Won') return { text: 'Closed Won', color: '#10b981' }
    return { text: 'No Action Needed', color: '#94a3b8' }
  }

  const handleSendCampaign = async () => {
    setIsSending(true);
    setCampaignResult(null);
    
    try {
      const formattedLeads = leads.map(l => ({
        id: l.id,
        email: l.email,
        name: l.contact_name,
        company: l.company
      }));

      const res = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'Is Your Manufacturing Data Ready for AI?',
          leads: formattedLeads
        })
      });

      const data = await res.json();
      setCampaignResult(data);
    } catch (err) {
      setCampaignResult({ error: err.message || 'An error occurred' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">Customer Leads</h1>
          <p style={{ color: '#94a3b8' }}>CNC Manufacturing Prospects Database</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn glass" onClick={handleExport}>
            <Settings2 size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }}/> 
            Export
          </button>
          <button className="btn glass" onClick={openAddModal}>
            <Plus size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }}/> 
            Add Lead
          </button>
          <button 
            className="btn" 
            style={{ backgroundColor: '#10b981', color: '#fff', border: 'none' }}
            onClick={() => setIsCampaignModalOpen(true)}
          >
            <Send size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }}/> 
            Send Campaign
          </button>
        </div>
      </div>

      {stats && (
        <div className="metrics-grid">
          <div className="glass glass-card">
            <div className="metric-label">
              <Users size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom', color: 'var(--primary)' }}/>
              Total Leads
            </div>
            <div className="metric-value">{stats.totalLeads?.toLocaleString()}</div>
          </div>
          <div className="glass glass-card">
            <div className="metric-label">
              <DollarSign size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom', color: '#10b981' }}/>
              Total Pipeline Value
            </div>
            <div className="metric-value">{formatCurrency(stats.totalOrderValue)}</div>
          </div>
          <div className="glass glass-card">
            <div className="metric-label">
              <Send size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom', color: '#f59e0b' }}/>
              Leads Contacted
            </div>
            <div className="metric-value">{stats.contactedLeads?.toLocaleString()}</div>
          </div>
          <div className="glass glass-card">
            <div className="metric-label">
              <Building2 size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom', color: 'var(--accent)' }}/>
              Deals Won
            </div>
            <div className="metric-value">{stats.wonLeads?.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
        <button 
          className={`btn ${viewMode === 'database' ? 'glass' : ''}`}
          style={{ 
            backgroundColor: viewMode === 'database' ? 'var(--card-bg)' : 'transparent',
            color: viewMode === 'database' ? 'white' : '#94a3b8' 
          }}
          onClick={() => setViewMode('database')}
        >
          Lead Database
        </button>
        <button 
          className={`btn ${viewMode === 'analytics' ? 'glass' : ''}`}
          style={{ 
            backgroundColor: viewMode === 'analytics' ? 'var(--card-bg)' : 'transparent',
            color: viewMode === 'analytics' ? 'white' : '#94a3b8' 
          }}
          onClick={() => setViewMode('analytics')}
        >
          Analytics & Patterns
        </button>
        <button 
          className={`btn ${viewMode === 'territories' ? 'glass' : ''}`}
          style={{ 
            backgroundColor: viewMode === 'territories' ? 'var(--card-bg)' : 'transparent',
            color: viewMode === 'territories' ? 'white' : '#94a3b8' 
          }}
          onClick={() => { setViewMode('territories'); fetchTerritories(); }}
        >
          Territory Performance
        </button>
      </div>

      {viewMode === 'database' ? (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
        <button 
          className={`btn ${activeTab === 'all' ? 'glass' : ''}`}
          style={{ background: activeTab === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeTab === 'all' ? '#fff' : '#94a3b8' }}
          onClick={() => handleTabChange('all')}
        >
          All Leads
        </button>
        <button 
          className={`btn ${activeTab === 'with_email' ? 'glass' : ''}`}
          style={{ background: activeTab === 'with_email' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeTab === 'with_email' ? '#fff' : '#94a3b8' }}
          onClick={() => handleTabChange('with_email')}
        >
          Has Email
        </button>
        <button 
          className={`btn ${activeTab === 'high_value' ? 'glass' : ''}`}
          style={{ background: activeTab === 'high_value' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeTab === 'high_value' ? '#fff' : '#94a3b8' }}
          onClick={() => handleTabChange('high_value')}
        >
          High Value (&gt;$50k)
        </button>
      </div>

      <div className="glass" style={{ padding: '2rem' }}>
        <div className="input-group">
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }}/>
            <input 
              type="text" 
              placeholder="Search all fields..." 
              className="input" 
              style={{ paddingLeft: '2.5rem' }}
              value={search}
              onChange={handleSearch}
            />
          </div>
          <select 
            className="input" 
            value={stateFilter} 
            onChange={(e) => { setStateFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
          >
            <option value="">All States</option>
            {stats?.topStates?.map(s => (
              <option key={s.state} value={s.state}>{s.state} ({s.count})</option>
            ))}
          </select>
          <select 
            className="input" 
            value={statusFilter} 
            onChange={(e) => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
          >
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Qualified">Qualified</option>
            <option value="Proposal">Proposal</option>
            <option value="Won">Won</option>
            <option value="Lost">Lost</option>
          </select>
          <select 
            className="input" 
            value={regionalManagerFilter} 
            onChange={(e) => { setRegionalManagerFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
          >
            <option value="">All Regions</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
              <option key={num} value={`Regional Sales Manager ${num}`}>RSM {num}</option>
            ))}
            <option value="Unassigned">Unassigned</option>
          </select>
        </div>

        {loading ? (
          <div className="loader"></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('company')} style={{ cursor: 'pointer' }}>Company {renderSortIndicator('company')}</th>
                  <th onClick={() => handleSort('state')} style={{ cursor: 'pointer' }}>Location {renderSortIndicator('state')}</th>
                  <th onClick={() => handleSort('contact_name')} style={{ cursor: 'pointer' }}>Contact {renderSortIndicator('contact_name')}</th>
                  <th onClick={() => handleSort('regional_manager')} style={{ cursor: 'pointer' }}>Region {renderSortIndicator('regional_manager')}</th>
                  <th onClick={() => handleSort('machine_make')} style={{ cursor: 'pointer' }}>Machine Info {renderSortIndicator('machine_make')}</th>
                  <th onClick={() => handleSort('order_value')} style={{ cursor: 'pointer' }}>Value {renderSortIndicator('order_value')}</th>
                  <th onClick={() => handleSort('lead_score')} style={{ cursor: 'pointer' }}>Score {renderSortIndicator('lead_score')}</th>
                  <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>Status {renderSortIndicator('status')}</th>
                  <th onClick={() => handleSort('next_action')} style={{ cursor: 'pointer' }}>Next Action {renderSortIndicator('next_action')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>{lead.company}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{lead.product || 'Unknown Product'}</div>
                    </td>
                    <td>
                      <div>{lead.city}, {lead.state} {lead.zip}</div>
                    </td>
                    <td>
                      <div>{lead.contact_name}</div>
                      <div style={{ color: '#94a3b8' }}>{lead.email ? lead.email : lead.contact_phone}</div>
                    </td>
                    <td>
                      <div style={{ color: 'var(--foreground)' }}>{lead.regional_manager || 'Unassigned'}</div>
                    </td>
                    <td>
                      {lead.machine_make ? (
                        <div className="badge">{lead.machine_make} {lead.machine_model}</div>
                      ) : (
                        <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>N/A</div>
                      )}
                      {lead.control && (
                        <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: '#94a3b8' }}>Control: {lead.control}</div>
                      )}
                    </td>
                    <td style={{ fontWeight: 600, color: '#10b981' }}>
                      {formatCurrency(lead.order_value)}
                    </td>
                    <td>
                      <div className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: 'none', fontWeight: 'bold' }}>
                        {lead.lead_score || 0}
                      </div>
                    </td>
                    <td>
                      <div className="badge" style={{
                        backgroundColor: lead.status === 'Won' ? 'rgba(16, 185, 129, 0.1)' : lead.status === 'Lost' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: lead.status === 'Won' ? '#10b981' : lead.status === 'Lost' ? '#ef4444' : '#3b82f6',
                        border: 'none'
                      }}>
                        {lead.status || 'New'}
                      </div>
                      {lead.last_contacted && (
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
                          {new Date(lead.last_contacted).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td>
                      {(() => {
                        const text = lead.next_action || 'No Action Needed';
                        let color = '#94a3b8';
                        if (text === 'Find Contact Info') color = '#f59e0b';
                        if (text === 'Send Intro') color = '#3b82f6';
                        if (text === 'Needs Follow-up') color = '#ef4444';
                        if (text === 'Send Proposal' || text === 'Closed Won') color = '#10b981';
                        return <div style={{ color, fontSize: '0.875rem', fontWeight: 500 }}>{text}</div>
                      })()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        onClick={() => openEditModal(lead)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {leads.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                No leads found matching your criteria.
              </div>
            )}
          </div>
        )}

        {!loading && leads.length > 0 && (
          <div className="pagination">
            <button 
              className="btn btn-secondary" 
              disabled={pagination.page <= 1}
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.875rem' }}>
              Page <strong style={{ color: 'white' }}>{pagination.page}</strong> of {pagination.totalPages}
            </span>
            <button 
              className="btn btn-secondary" 
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
      </>
    ) : viewMode === 'analytics' ? (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {analyticsData ? (
          <>
            <div className="glass glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--foreground)' }}>Average Value by Machine Type</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={analyticsData.valueByMachine}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: '#94a3b8' }} tickFormatter={(val) => `$${val/1000}k`}/>
                    <Radar name="Value" dataKey="avg_value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                    <Tooltip formatter={(val) => formatCurrency(val)} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--foreground)' }}>Sales Funnel Drop-off</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.funnelData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorFunnel" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
                    <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorFunnel)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--foreground)' }}>Pipeline Value by Stage</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.pipelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPipeline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" tickFormatter={(val) => `$${val/1000}k`} />
                    <Tooltip formatter={(val) => formatCurrency(val)} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPipeline)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--foreground)' }}>Top Regions by Deals Won</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analyticsData.statesWon} dataKey="won_deals" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} label>
                      {analyticsData.statesWon.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#14b8a6', '#f43f5e', '#6366f1', '#eab308', '#22c55e'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass glass-card" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--foreground)' }}>Control Systems Breakdown</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analyticsData.controlData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {analyticsData.controlData?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : (
          <div className="loader"></div>
        )}
      </div>
    ) : (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        {territoryData ? (
          <div className="glass glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--foreground)' }}>Territory Leaderboard</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Regional Manager</th>
                    <th>Total Leads</th>
                    <th>Active Pipeline</th>
                    <th>Won Deals</th>
                    <th>Pipeline Value</th>
                  </tr>
                </thead>
                <tbody>
                  {territoryData.map(t => (
                    <tr key={t.name}>
                      <td style={{ fontWeight: 600, color: 'var(--foreground)' }}>{t.name}</td>
                      <td>{t.total_leads}</td>
                      <td>{t.active_leads}</td>
                      <td style={{ fontWeight: 600, color: '#10b981' }}>{t.won_deals}</td>
                      <td style={{ color: '#3b82f6' }}>{formatCurrency(t.total_pipeline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="loader"></div>
        )}
      </div>
    )}      {/* Add/Edit Lead Modal */}
      {isLeadModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass glass-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', position: 'relative' }}>
            <button 
              onClick={() => setIsLeadModalOpen(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            
            <h2 style={{ marginTop: 0, color: 'var(--foreground)' }}>{editingLead ? 'Edit Lead' : 'Add New Lead'}</h2>
            
            <form onSubmit={handleSaveLead} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>Company Name *</label>
                  <input required className="input" style={{ width: '100%' }} value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>Order Value ($)</label>
                  <input type="number" className="input" style={{ width: '100%' }} value={formData.order_value} onChange={e => setFormData({...formData, order_value: e.target.value})} />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>Contact Name</label>
                  <input className="input" style={{ width: '100%' }} value={formData.contact_name} onChange={e => setFormData({...formData, contact_name: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>Email</label>
                  <input type="email" className="input" style={{ width: '100%' }} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>Phone</label>
                  <input className="input" style={{ width: '100%' }} value={formData.contact_phone} onChange={e => setFormData({...formData, contact_phone: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>City</label>
                  <input className="input" style={{ width: '100%' }} value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>State</label>
                  <input className="input" style={{ width: '100%' }} value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>Zip</label>
                  <input className="input" style={{ width: '100%' }} value={formData.zip} onChange={e => setFormData({...formData, zip: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>Machine Make</label>
                  <input className="input" style={{ width: '100%' }} value={formData.machine_make} onChange={e => setFormData({...formData, machine_make: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>Machine Model</label>
                  <input className="input" style={{ width: '100%' }} value={formData.machine_model} onChange={e => setFormData({...formData, machine_model: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>Status</label>
                  <select className="input" style={{ width: '100%' }} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Proposal">Proposal</option>
                    <option value="Won">Won</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>Last Contacted Date</label>
                  <input type="date" className="input" style={{ width: '100%' }} value={formData.last_contacted} onChange={e => setFormData({...formData, last_contacted: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1rem' }}>
                <button type="button" className="btn glass" onClick={() => setIsLeadModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn" style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none' }} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaign Modal */}
      {isCampaignModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass glass-card" style={{ width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
            <button 
              onClick={() => { setIsCampaignModalOpen(false); setCampaignResult(null); }}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            
            <h2 style={{ marginTop: 0, color: 'var(--foreground)' }}>Dispatch Email Campaign</h2>
            
            {!campaignResult ? (
              <>
                <p style={{ color: '#94a3b8', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                  You are about to send the <strong>"Data Readiness"</strong> campaign to the <strong>{leads.length} leads</strong> currently visible on this page.
                </p>
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                  <p style={{ margin: 0, color: '#10b981', fontSize: '0.875rem' }}>
                    <strong>Note:</strong> Ensure your Resend API key is configured in your environment variables.
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="btn glass" onClick={() => setIsCampaignModalOpen(false)}>Cancel</button>
                  <button 
                    className="btn" 
                    style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none' }}
                    onClick={handleSendCampaign}
                    disabled={isSending}
                  >
                    {isSending ? 'Sending...' : 'Confirm & Send'}
                  </button>
                </div>
              </>
            ) : (
              <div>
                {campaignResult.error ? (
                  <div style={{ color: '#ef4444', marginBottom: '1.5rem' }}>
                    <strong>Error:</strong> {campaignResult.error}
                  </div>
                ) : (
                  <div style={{ color: '#10b981', marginBottom: '1.5rem' }}>
                    <strong>Success!</strong> {campaignResult.message}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn glass" onClick={() => setIsCampaignModalOpen(false)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
