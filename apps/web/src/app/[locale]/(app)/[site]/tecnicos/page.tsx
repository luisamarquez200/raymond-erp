'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Edit, X, AlertCircle, Plus, Search, User, Save, Trash2, Award, Shield, Users } from 'lucide-react'
import { QrScannerButton } from '@/components/ui/qr-scanner-button'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Loader from '@/components/ui/loader'
import {
    useTallerTecnicos,
    useCreateTallerTecnico,
    useUpdateTallerTecnico,
    useDeleteTallerTecnico,
    type TallerTecnico
} from '@/hooks/taller-r1/useTallerTecnicos'
import { useAuthStore } from '@/store/auth.store'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

const CERTIFICATION_LEVELS = [
    'Junior',
    'Tech primer certificado',
    'Senior',
    'Externo'
]

export default function TallerR1TecnicosPage() {
    const params = useParams()
    const site = params.site as string
    const { user: currentUser } = useAuthStore()
    
    const { data: tecnicos = [], isLoading } = useTallerTecnicos()
    const createTecnico = useCreateTallerTecnico()
    const updateTecnico = useUpdateTallerTecnico()
    const deleteTecnico = useDeleteTallerTecnico()

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isCreateMode, setIsCreateMode] = useState(false)
    const [selectedTecnico, setSelectedTecnico] = useState<TallerTecnico | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    const [showConfirmCancel, setShowConfirmCancel] = useState(false)
    const [showConfirmDelete, setShowConfirmDelete] = useState(false)
    const [tecnicoToDelete, setTecnicoToDelete] = useState<TallerTecnico | null>(null)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [isEditingTecnico, setIsEditingTecnico] = useState(false)

    const canManageTecnicos = (() => {
        const roleName = typeof currentUser?.role === 'string'
            ? currentUser.role
            : (currentUser?.role as any)?.name;
        return roleName && ['Superadmin', 'Admin', 'Administrador'].includes(roleName);
    })()

    const handleCreate = () => {
        setSelectedTecnico(null)
        setIsCreateMode(true)
        setIsDialogOpen(true)
        setIsEditingTecnico(false)
        setShowDetailModal(false)
        setShowConfirmCancel(false)
    }

    const handleEdit = (tecnico: TallerTecnico) => {
        setSelectedTecnico(tecnico)
        setIsCreateMode(false)
        setIsDialogOpen(true)
        setIsEditingTecnico(true)
        setShowDetailModal(false)
        setShowConfirmCancel(false)
    }

    const handleViewDetails = (tecnico: TallerTecnico) => {
        setSelectedTecnico(tecnico)
        setIsCreateMode(false)
        setIsDialogOpen(false)
        setIsEditingTecnico(false)
        setShowDetailModal(true)
        setShowConfirmCancel(false)
    }

    const requestClose = () => {
        setShowConfirmCancel(true);
    }

    const confirmClose = () => {
        setShowConfirmCancel(false);
        setIsDialogOpen(false);
        setIsEditingTecnico(false);
        setIsCreateMode(false);
        setShowDetailModal(false);
        setSelectedTecnico(null);
    }

    const cancelClose = () => {
        setShowConfirmCancel(false);
    }

    const handleDeleteClick = (e: React.MouseEvent, tecnico: TallerTecnico) => {
        e.stopPropagation()
        setTecnicoToDelete(tecnico)
        setShowConfirmDelete(true)
    }

    const confirmDelete = async () => {
        if (!tecnicoToDelete) return
        try {
            await deleteTecnico.mutateAsync(tecnicoToDelete.id_tecnico)
            setShowConfirmDelete(false)
            setTecnicoToDelete(null)
            if (showDetailModal) {
                setShowDetailModal(false)
            }
        } catch (error) {
            console.error(error)
        }
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)

        const data: Partial<TallerTecnico> = {
            nombre: formData.get('nombre') as string,
            nivel_certificacion: formData.get('nivel_certificacion') as string,
        }

        try {
            if (isCreateMode) {
                await createTecnico.mutateAsync(data)
            } else if (selectedTecnico) {
                await updateTecnico.mutateAsync({ id: selectedTecnico.id_tecnico, data })
            }
            setIsDialogOpen(false)
            setIsEditingTecnico(false)
            setIsCreateMode(false)
            setShowDetailModal(false)
            setSelectedTecnico(null)
        } catch (error) {
            // Error is handled in the hooks
        }
    }

    const filteredTecnicos = tecnicos.filter(tecnico => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (
            tecnico.nombre.toLowerCase().includes(query) ||
            tecnico.nivel_certificacion.toLowerCase().includes(query)
        )
    });

    return (
        <div className="space-y-4 sm:space-y-6 lg:p-6 p-4 max-w-7xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1 w-full">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar técnico por nombre o certificación..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-white border-none rounded-2xl shadow-sm text-sm font-medium focus:ring-2 focus:ring-red-500 transition-shadow transition-colors outline-none"
                        />
                    </div>
                    <QrScannerButton onScan={(value) => setSearchQuery(value)} />
                </div>
                {canManageTecnicos && (
                    <Button onClick={handleCreate} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white rounded-xl px-6 h-12 shadow-md shadow-red-500/20 transition-all font-bold">
                        <Plus className="w-5 h-5 mr-2" />
                        Nuevo Técnico
                    </Button>
                )}
            </div>

            {isLoading ? (
                <div className="p-8 sm:p-12">
                    <Loader size="lg" text={`Cargando técnicos del taller...`} />
                </div>
            ) : filteredTecnicos.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">
                        {searchQuery ? 'No se encontraron técnicos que coincidan con la búsqueda' : `No hay técnicos registrados`}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredTecnicos.map((tecnico) => {
                        const levelColors: Record<string, string> = {
                            'Junior': 'bg-blue-50 text-blue-700 border-blue-100',
                            'Tech primer certificado': 'bg-violet-50 text-violet-700 border-violet-100',
                            'Senior': 'bg-amber-50 text-amber-700 border-amber-100',
                            'Externo': 'bg-slate-100 text-slate-700 border-slate-200'
                        }

                        const levelColor = levelColors[tecnico.nivel_certificacion] || 'bg-gray-50 text-gray-700 border-gray-100'

                        return (
                            <div
                                key={tecnico.id_tecnico}
                                onClick={() => handleViewDetails(tecnico)}
                                className="group bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm hover:shadow-2xl hover:border-red-100 transition-all cursor-pointer relative overflow-hidden"
                            >
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center border group-hover:scale-105 transition-transform bg-red-50 border-red-100 text-red-600">
                                        <User className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-black text-gray-900 leading-none group-hover:text-[#D8262F] transition-colors truncate">
                                            {tecnico.nombre}
                                        </h3>
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1.5 truncate">
                                            Certificación
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-4 border-t border-gray-50">
                                    <Award className="w-4 h-4 text-gray-400" />
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${levelColor}`}>
                                        {tecnico.nivel_certificacion}
                                    </span>
                                </div>

                                {canManageTecnicos && (
                                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-50 z-20 relative">
                                        <button
                                            onClick={(e) => handleDeleteClick(e, tecnico)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(tecnico);
                                            }}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                            title="Editar"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Dialog for Create / View / Edit */}
            {(isDialogOpen || showDetailModal) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-50 p-4" style={{ zIndex: 9999 }}>
                    <div className="bg-gray-50 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="bg-white border-b border-gray-100 p-8 flex justify-between items-start flex-none relative overflow-hidden">
                            <div className="relative z-10 w-full flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">
                                        {isCreateMode ? 'Nuevo Técnico' : (isEditingTecnico || isDialogOpen ? 'Editando Técnico' : 'Detalles Técnico')}
                                    </p>
                                    <h2 className="text-4xl font-black text-gray-900 leading-tight tracking-tight mt-1">
                                        {isCreateMode ? 'Registrar Técnico' : selectedTecnico?.nombre}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            if (isCreateMode || isEditingTecnico || isDialogOpen) {
                                                requestClose();
                                            } else {
                                                setShowDetailModal(false);
                                            }
                                        }}
                                        className="p-3 hover:bg-gray-50 rounded-2xl transition-all text-gray-400 relative z-10"
                                    >
                                        <X className="w-8 h-8" />
                                    </button>
                                </div>
                            </div>
                            <div className="absolute right-0 top-0 opacity-[0.02] rotate-12 -mr-10 -mt-10 pointer-events-none">
                                <Shield className="w-48 h-48" />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            {!isCreateMode && !isEditingTecnico && !isDialogOpen ? (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-1">
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Nombre Completo</p>
                                            <p className="text-sm font-bold text-gray-800 break-all">{selectedTecnico?.nombre || '---'}</p>
                                        </div>
                                        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-1">
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Nivel de Certificación</p>
                                            <p className="text-sm font-bold text-gray-800">{selectedTecnico?.nivel_certificacion}</p>
                                        </div>
                                    </div>

                                    {canManageTecnicos && (
                                        <div className="flex justify-end gap-3 mt-4">
                                            <button
                                                onClick={(e) => selectedTecnico && handleDeleteClick(e as any, selectedTecnico)}
                                                className="px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Eliminar
                                            </button>
                                            <button
                                                onClick={() => setIsEditingTecnico(true)}
                                                className="px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 bg-gray-900 text-white shadow-lg hover:bg-gray-800"
                                            >
                                                <Edit className="w-3.5 h-3.5" />
                                                Editar Técnico
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <form key={`form-mode-${isCreateMode ? 'create' : 'edit'}`} onSubmit={handleSubmit} className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-4">Nombre Completo</label>
                                            <input
                                                type="text"
                                                name="nombre"
                                                defaultValue={selectedTecnico?.nombre}
                                                className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-red-50 focus:border-[#D8262F] outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                                required
                                                disabled={!canManageTecnicos && !isCreateMode}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-4">Nivel de Certificación</label>
                                            <select
                                                name="nivel_certificacion"
                                                defaultValue={selectedTecnico?.nivel_certificacion || ''}
                                                className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-red-50 focus:border-[#D8262F] outline-none transition-all appearance-none disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                                required
                                                disabled={!canManageTecnicos && !isCreateMode}
                                            >
                                                <option value="" disabled>Seleccione nivel</option>
                                                {CERTIFICATION_LEVELS.map((level) => (
                                                    <option key={level} value={level}>
                                                        {level}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 pt-4">
                                        <button
                                            type="button"
                                            onClick={requestClose}
                                            className="w-full bg-white text-gray-700 border border-gray-200 font-black px-8 py-4 rounded-2xl hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={updateTecnico.isPending || createTecnico.isPending}
                                            className="w-full bg-[#D8262F] text-white font-black px-8 py-4 rounded-2xl hover:bg-[#b91c24] transition-all shadow-xl shadow-red-100 flex items-center justify-center gap-2 uppercase tracking-widest text-sm disabled:opacity-50"
                                        >
                                            <Save className="w-5 h-5" />
                                            {updateTecnico.isPending || createTecnico.isPending ? 'Guardando...' : (isCreateMode ? 'Registrar' : 'Guardar Cambios')}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>

                        {/* Confirmation Overlay for cancel */}
                        {showConfirmCancel && (isEditingTecnico || isCreateMode || isDialogOpen) && (
                            <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-white/60 backdrop-blur-[2px] animate-in fade-in duration-200 rounded-[3rem]">
                                <Card className="w-full max-w-sm p-6 shadow-2xl border-red-100/50 bg-white animate-in zoom-in-95 duration-200">
                                    <div className="flex flex-col items-center text-center">
                                        <div className="w-12 h-12 bg-red-100/80 rounded-full flex items-center justify-center mb-4">
                                            <AlertCircle className="w-6 h-6 text-[#D8262F]" />
                                        </div>
                                        <h3 className="text-lg font-black text-gray-900 mb-2">¿Descartar cambios?</h3>
                                        <p className="text-sm font-medium text-gray-500 mb-6">
                                            Si cierras esta ventana sin guardar perderás la información ingresada.
                                        </p>
                                        <div className="flex bg-gray-50/50 p-1 rounded-xl w-full gap-1">
                                            <Button
                                                type="button"
                                                onClick={cancelClose}
                                                variant="ghost"
                                                className="flex-1 rounded-lg h-10 font-bold hover:bg-white hover:text-gray-900 text-gray-500 hover:shadow-sm"
                                            >
                                                Volver
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={confirmClose}
                                                className="flex-1 rounded-lg h-10 font-bold bg-[#D8262F] hover:bg-[#b91c24] border border-transparent shadow-[0_2px_10px_-4px_rgba(216,38,47,0.5)] text-white"
                                            >
                                                Descartar
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Confirmation Overlay for delete */}
            {showConfirmDelete && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-50 p-4" style={{ zIndex: 10000 }}>
                    <Card className="w-full max-w-sm p-6 shadow-2xl border-red-100/50 bg-white animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-red-100/80 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle className="w-6 h-6 text-[#D8262F]" />
                            </div>
                            <h3 className="text-lg font-black text-gray-900 mb-2">¿Eliminar técnico?</h3>
                            <p className="text-sm font-medium text-gray-500 mb-6">
                                Esta acción eliminará permanentemente al técnico <strong>{tecnicoToDelete?.nombre}</strong>. ¿Deseas continuar?
                            </p>
                            <div className="flex bg-gray-50/50 p-1 rounded-xl w-full gap-1">
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setShowConfirmDelete(false)
                                        setTecnicoToDelete(null)
                                    }}
                                    variant="ghost"
                                    className="flex-1 rounded-lg h-10 font-bold hover:bg-white hover:text-gray-900 text-gray-500 hover:shadow-sm"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="button"
                                    onClick={confirmDelete}
                                    className="flex-1 rounded-lg h-10 font-bold bg-[#D8262F] hover:bg-[#b91c24] border border-transparent shadow-[0_2px_10px_-4px_rgba(216,38,47,0.5)] text-white"
                                >
                                    Eliminar
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    )
}
