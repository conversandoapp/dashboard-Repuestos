import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Target, Users, Award, Phone, BarChart3, RefreshCw, AlertCircle, Calendar } from 'lucide-react';
import Papa from 'papaparse';

export default function SalesDashboard() {
  const [budget, setBudget] = useState(150000);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('octubre');
  const [noDataForMonth, setNoDataForMonth] = useState(false);

  // 🔥 CONFIGURACIÓN DE HOJAS POR MES
  const SHEET_CONFIG = {
    octubre: {
      gid: '1351719326',
      name: 'Octubre',
      exists: true
    },
    noviembre: {
      gid: 'PENDIENTE', // Cambiar cuando exista la hoja
      name: 'Noviembre',
      exists: false // Cambiar a true cuando exista
    },
    diciembre: {
      gid: 'PENDIENTE', // Cambiar cuando exista la hoja
      name: 'Diciembre',
      exists: false // Cambiar a true cuando exista
    }
  };

  const SHEET_ID = '1p9SXOZUmArwINrMUdOlmQrGc3BcMT4Zh6S-pIL8xxXc';

  // Función para cargar datos desde Google Sheets
  const loadDataFromSheet = async (month) => {
    try {
      setLoading(true);
      setError(null);
      setNoDataForMonth(false);

      const monthConfig = SHEET_CONFIG[month];

      // Verificar si la hoja existe
      if (!monthConfig.exists) {
        setNoDataForMonth(true);
        setLoading(false);
        setMetrics(null);
        return;
      }

      const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${monthConfig.gid}`;
      const response = await fetch(SHEET_URL);
      
      if (!response.ok) {
        throw new Error('No se pudo conectar con Google Sheets. Verifica que el Sheet sea público.');
      }

      const csvText = await response.text();

      // Parsear CSV con PapaParse
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            // Filtrar solo registros con campaña
            const filteredData = results.data.filter(row => {
              const campaign = row['Campaña'];
              return campaign && campaign.trim() !== '';
            });

            if (filteredData.length === 0) {
              setNoDataForMonth(true);
              setLoading(false);
              setMetrics(null);
              return;
            }

            calculateMetrics(filteredData, budget);
            setLastUpdate(new Date());
            setLoading(false);
          } else {
            setNoDataForMonth(true);
            setLoading(false);
            setMetrics(null);
          }
        },
        error: (error) => {
          throw new Error('Error al parsear datos: ' + error.message);
        }
      });
    } catch (err) {
      setError(err.message);
      setLoading(false);
      console.error('Error cargando datos:', err);
    }
  };

  // Cargar datos al iniciar y cuando cambia el mes
  useEffect(() => {
    loadDataFromSheet(selectedMonth);
  }, [selectedMonth]);

  // Recalcular métricas cuando cambia el presupuesto
  useEffect(() => {
    if (metrics && metrics.rawData) {
      calculateMetrics(metrics.rawData, budget);
    }
  }, [budget]);

  const calculateMetrics = (salesData, monthlyBudget) => {
    const totalSales = salesData
      .filter(row => row['¿Venta?'] === 'Sí' || row['¿Venta?'] === 'SI' || row['¿Venta?'] === 'Si')
      .reduce((sum, row) => sum + (parseFloat(row['Monto Venta']) || 0), 0);

    const totalLeads = salesData.length;
    const qualifiedLeads = salesData.filter(row => 
      row['¿Lead calificado?'] === 'Sí' || 
      row['¿Lead calificado?'] === 'SI' || 
      row['¿Lead calificado?'] === 'Si'
    ).length;
    
    const reservations = salesData.filter(row => 
      row['¿Reservó?'] === 'Sí' || 
      row['¿Reservó?'] === 'SI' || 
      row['¿Reservó?'] === 'Si'
    ).length;
    
    const salesCount = salesData.filter(row => 
      row['¿Venta?'] === 'Sí' || 
      row['¿Venta?'] === 'SI' || 
      row['¿Venta?'] === 'Si'
    ).length;
    
    const conversionRate = totalLeads > 0 ? (salesCount / totalLeads) * 100 : 0;
    const budgetProgress = monthlyBudget > 0 ? (totalSales / monthlyBudget) * 100 : 0;

    const cpl = totalLeads > 0 ? monthlyBudget / totalLeads : 0;
    const cplc = qualifiedLeads > 0 ? monthlyBudget / qualifiedLeads : 0;

    // Ventas por campaña (ya filtrado sin "Sin campaña")
    const salesByCampaign = {};
    salesData.forEach(row => {
      const campaign = row['Campaña'];
      if (!salesByCampaign[campaign]) {
        salesByCampaign[campaign] = {
          leads: 0,
          qualified: 0,
          sales: 0,
          amount: 0
        };
      }
      salesByCampaign[campaign].leads += 1;
      if (row['¿Lead calificado?'] === 'Sí' || row['¿Lead calificado?'] === 'SI') {
        salesByCampaign[campaign].qualified += 1;
      }
      if (row['¿Venta?'] === 'Sí' || row['¿Venta?'] === 'SI') {
        salesByCampaign[campaign].sales += 1;
        salesByCampaign[campaign].amount += parseFloat(row['Monto Venta']) || 0;
      }
    });

    // Ventas por asesor
    const salesByAdvisor = {};
    salesData
      .filter(row => row['¿Venta?'] === 'Sí' || row['¿Venta?'] === 'SI')
      .forEach(row => {
        const advisor = row['Asesor'] || 'Sin asignar';
        if (!salesByAdvisor[advisor]) {
          salesByAdvisor[advisor] = { count: 0, amount: 0 };
        }
        salesByAdvisor[advisor].count += 1;
        salesByAdvisor[advisor].amount += parseFloat(row['Monto Venta']) || 0;
      });

    // Leads por medio de contacto
    const leadsBySource = {};
    salesData.forEach(row => {
      const source = row['Medio de contacto'] || 'Desconocido';
      leadsBySource[source] = (leadsBySource[source] || 0) + 1;
    });

    setMetrics({
      totalSales,
      totalLeads,
      qualifiedLeads,
      reservations,
      salesCount,
      conversionRate,
      budgetProgress,
      cpl,
      cplc,
      salesByCampaign,
      salesByAdvisor,
      leadsBySource,
      rawData: salesData
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 text-lg font-medium">Cargando datos desde Google Sheets...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border-2 border-red-200">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <h2 className="text-xl font-bold text-slate-800">Error de conexión</h2>
          </div>
          <p className="text-slate-600 mb-4">{error}</p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-slate-700 font-semibold mb-2">📋 Pasos para solucionar:</p>
            <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
              <li>Abre tu Google Sheet</li>
              <li>Haz clic en "Compartir" (esquina superior derecha)</li>
              <li>En "Acceso general", selecciona "Cualquier persona con el enlace"</li>
              <li>Configura el permiso como "Lector"</li>
              <li>Guarda los cambios</li>
            </ol>
          </div>
          <button
            onClick={() => loadDataFromSheet(selectedMonth)}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Reintentar conexión
          </button>
        </div>
      </div>
    );
  }

  // No data for month state
  if (noDataForMonth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Month Tabs */}
          <div className="mb-8">
            <div className="flex gap-2 bg-white rounded-xl shadow-lg p-2 border border-slate-200 inline-flex">
              {Object.keys(SHEET_CONFIG).map((month) => (
                <button
                  key={month}
                  onClick={() => setSelectedMonth(month)}
                  className={`px-6 py-3 rounded-lg font-semibold transition capitalize ${
                    selectedMonth === month
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {SHEET_CONFIG[month].name}
                </button>
              ))}
            </div>
          </div>

          {/* No Data Message */}
          <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
            <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md w-full border-2 border-slate-200 text-center">
              <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-800 mb-3">
                {SHEET_CONFIG[selectedMonth].name}
              </h2>
              <p className="text-slate-600 text-lg">
                Este mes aún no cuenta con información
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Month Tabs */}
        <div className="mb-8">
          <div className="flex gap-2 bg-white rounded-xl shadow-lg p-2 border border-slate-200 inline-flex">
            {Object.keys(SHEET_CONFIG).map((month) => (
              <button
                key={month}
                onClick={() => setSelectedMonth(month)}
                className={`px-6 py-3 rounded-lg font-semibold transition capitalize ${
                  selectedMonth === month
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {SHEET_CONFIG[month].name}
              </button>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Dashboard de Ventas</h1>
            <p className="text-slate-600">
              {SHEET_CONFIG[selectedMonth].name} 2024 • 
              {lastUpdate && (
                <span className="ml-2">
                  Última actualización: {lastUpdate.toLocaleTimeString('es-PE')}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => loadDataFromSheet(selectedMonth)}
              className="bg-white rounded-xl shadow-lg px-4 py-3 border-2 border-slate-200 hover:border-blue-300 transition flex items-center gap-2 text-slate-700 font-medium"
            >
              <RefreshCw className="w-5 h-5" />
              Actualizar datos
            </button>
            <div className="bg-white rounded-xl shadow-lg px-6 py-4 border-2 border-blue-100">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                💰 Presupuesto del Mes
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-slate-600 font-medium">S/</span>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
                  className="w-full pl-10 pr-4 py-2.5 text-xl font-bold border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Main Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-xl p-6 text-white transform transition hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-white bg-opacity-20 p-3 rounded-xl">
                <DollarSign className="w-7 h-7" />
              </div>
              <span className="text-sm font-semibold opacity-90 uppercase tracking-wide">Ventas</span>
            </div>
            <div className="text-4xl font-bold mb-1">{formatCurrency(metrics.totalSales)}</div>
            <div className="text-emerald-100 font-medium">
              {metrics.salesCount} ventas cerradas
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white transform transition hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-white bg-opacity-20 p-3 rounded-xl">
                <Target className="w-7 h-7" />
              </div>
              <span className="text-sm font-semibold opacity-90 uppercase tracking-wide">Meta</span>
            </div>
            <div className="text-4xl font-bold mb-1">{metrics.budgetProgress.toFixed(1)}%</div>
            <div className="text-blue-100 font-medium mb-3">
              de {formatCurrency(budget)}
            </div>
            <div className="bg-white bg-opacity-20 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-white h-full rounded-full transition-all duration-700 shadow-lg"
                style={{ width: `${Math.min(metrics.budgetProgress, 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white transform transition hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-white bg-opacity-20 p-3 rounded-xl">
                <Users className="w-7 h-7" />
              </div>
              <span className="text-sm font-semibold opacity-90 uppercase tracking-wide">Leads</span>
            </div>
            <div className="text-4xl font-bold mb-1">{metrics.totalLeads}</div>
            <div className="text-purple-100 font-medium">
              {metrics.qualifiedLeads} calificados ({((metrics.qualifiedLeads/metrics.totalLeads)*100).toFixed(0)}%)
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-xl p-6 text-white transform transition hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-white bg-opacity-20 p-3 rounded-xl">
                <TrendingUp className="w-7 h-7" />
              </div>
              <span className="text-sm font-semibold opacity-90 uppercase tracking-wide">Conversión</span>
            </div>
            <div className="text-4xl font-bold mb-1">{metrics.conversionRate.toFixed(1)}%</div>
            <div className="text-orange-100 font-medium">
              {metrics.reservations} reservas activas
            </div>
          </div>
        </div>

        {/* Tabla de Resultados por Campaña */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-2.5 rounded-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Resultados por Campaña</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-slate-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">#</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Campaña</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Leads</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">CPL</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Leads Calificados</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">CPLC</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Compras</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Inversión</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(metrics.salesByCampaign)
                  .sort((a, b) => b[1].amount - a[1].amount)
                  .map(([campaign, data], idx) => {
                    const campaignCPL = data.leads > 0 ? (data.leads * metrics.cpl) / data.leads : 0;
                    const campaignCPLC = data.qualified > 0 ? (data.leads * metrics.cpl) / data.qualified : 0;
                    const investment = data.leads * metrics.cpl;
                    return (
                      <tr key={campaign} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="px-4 py-3 text-sm text-slate-600">{idx + 1}.</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">{campaign}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                            {data.leads}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{formatCurrency(campaignCPL)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                            {data.qualified}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">{formatCurrency(campaignCPLC)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm font-semibold">
                            {data.sales}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center justify-center px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-bold">
                            {formatCurrency(investment)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <td className="px-4 py-3 text-sm text-slate-800" colSpan="2">Total</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-800">{metrics.totalLeads}</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-800">{formatCurrency(metrics.cpl)}</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-800">{metrics.qualifiedLeads}</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-800">{formatCurrency(metrics.cplc)}</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-800">{metrics.salesCount}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-800">{formatCurrency(budget)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Secondary Metrics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Sales by Advisor */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-lg">
                <Award className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Top Asesores</h3>
            </div>
            <div className="space-y-3">
              {Object.entries(metrics.salesByAdvisor).length > 0 ? (
                Object.entries(metrics.salesByAdvisor)
                  .sort((a, b) => b[1].amount - a[1].amount)
                  .map(([advisor, data], idx) => (
                    <div key={advisor} className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200">
                      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{advisor}</div>
                        <div className="text-sm text-slate-500">{data.count} ventas</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-800">{formatCurrency(data.amount)}</div>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="text-slate-500 text-center py-4">No hay ventas registradas</p>
              )}
            </div>
          </div>

          {/* Leads by Source */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-2.5 rounded-lg">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Medios de Contacto</h3>
            </div>
            <div className="space-y-4">
              {Object.entries(metrics.leadsBySource)
                .sort((a, b) => b[1] - a[1])
                .map(([source, count]) => {
                  const percentage = (count / metrics.totalLeads) * 100;
                  return (
                    <div key={source}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-700">{source}</span>
                        <span className="text-sm font-bold text-slate-800">{count} <span className="text-slate-500">({percentage.toFixed(0)}%)</span></span>
                      </div>
                      <div className="bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-700"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Cost Metrics */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-lg">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Métricas de Costo</h3>
            </div>
            <div className="space-y-3">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                <div className="text-xs text-slate-600 mb-1 uppercase font-semibold">CPL (Costo por Lead)</div>
                <div className="text-2xl font-bold text-blue-700">{formatCurrency(metrics.cpl)}</div>
                <div className="text-xs text-slate-500 mt-1">Presupuesto ÷ Total Leads</div>
              </div>
              <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                <div className="text-xs text-slate-600 mb-1 uppercase font-semibold">CPLC (Costo por Lead Calificado)</div>
<div className="text-2xl font-bold text-purple-700">{formatCurrency(metrics.cplc)}</div>
<div className="text-xs text-slate-500 mt-1">Presupuesto ÷ Leads Calificados</div>
</div>
<div className="p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200">
<div className="text-xs text-slate-600 mb-1 uppercase font-semibold">Presupuesto Total</div>
<div className="text-2xl font-bold text-emerald-700">{formatCurrency(budget)}</div>
<div className="text-xs text-slate-500 mt-1">Inversión del mes</div>
</div>
</div>
</div>
</div>
    {/* Footer Badge */}
    <div className="text-center">
      <div className="inline-flex items-center gap-2 bg-white rounded-full px-5 py-2.5 shadow-lg border border-slate-200">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm font-medium text-slate-700">Conectado a Google Sheets</span>
      </div>
    </div>
  </div>
</div>
);
}
