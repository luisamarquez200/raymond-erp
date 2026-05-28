'use client';

import { Cliente, clientesApi } from '@/services/taller-r1/clientes.service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import {
    Mail, Phone, User, Edit, Trash2,
    Briefcase, FileText, Building2, MapPin, AlertCircle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { ClienteForm } from '@/components/taller-r1/clientes/ClienteForm';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';

interface ClienteDetailsPanelProps {
    clientId: string;
    onClose: () => void;
    onUpdateSuccess?: () => void;
}

export function ClienteDetailsPanel({ clientId, onClose, onUpdateSuccess }: ClienteDetailsPanelProps) {
    const [client, setClient] = useState<Cliente | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [showConfirmCancel, setShowConfirmCancel] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (clientId) {
            loadClientDetails();
        }
    }, [clientId]);

    const loadClientDetails = async () => {
        try {
            setIsLoading(true);
            const data = await clientesApi.getById(clientId);
            setClient(data);
        } catch (error) {
            toast.error(getErrorMessage(error, 'Error al cargar los detalles del cliente'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdate = async (data: any) => {
        try {
            setIsSubmitting(true);
            await clientesApi.update(clientId, data);
            toast.success('Cliente actualizado correctamente');
            setIsEditOpen(false);
            loadClientDetails();
            if (onUpdateSuccess) onUpdateSuccess();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Error al actualizar el cliente'));
        } finally {
            setIsSubmitting(false);
        }
    };


    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                    <span className="text-sm font-medium">Cargando detalles...</span>
                </div>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <h2 className="text-xl font-bold text-gray-900">Cliente no encontrado</h2>
                <Button variant="outline" onClick={onClose} className="border-gray-200">
                    Cerrar Panel
                </Button>
            </div>
        );
    }

    const fullAddress = [client.calle, client.numero_calle, client.ciudad, client.cp].filter(Boolean).join(', ');

    return (
        <div className="w-full flex flex-col bg-white">
            {/* Header */}
            <div className="flex-none p-6 border-b border-gray-100 bg-gray-50/50 relative">
                <div className="flex items-start justify-between pr-8">
                    <div className="flex items-center gap-5">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-red-500/20 shrink-0">
                            {client.nombre_cliente?.charAt(0) || 'C'}
                        </div>
                        <div className="space-y-1.5">
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-none">{client.nombre_cliente}</h2>
                            {client.razon_social && (
                                <p className="text-sm text-gray-500 font-medium">
                                    {client.razon_social}
                                </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 !mb-0">
                                {client.rfc && (
                                    <span className="text-xs font-mono font-bold text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200 uppercase">
                                        RFC: {client.rfc}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 space-y-6">

                <div className="space-y-6">
                    <Card className="border-none shadow-none bg-transparent">
                        <CardContent className="p-0 space-y-6">
                            {/* Contact Info Section */}
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                <div className="p-5 border-b border-gray-100 bg-gray-50">
                                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                        <User className="w-4 h-4 text-red-600" />
                                        Información y Contacto
                                    </h3>
                                </div>
                                <div className="p-5 space-y-6">
                                    {/* Contact Person */}
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                                            <User className="w-4 h-4 text-red-600" />
                                        </div>
                                        <div className="space-y-1 mt-1">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Persona de Contacto</p>
                                            <p className="text-sm font-semibold text-gray-900">{client.persona_contacto || 'No registrado'}</p>
                                        </div>
                                    </div>

                                    {/* Phone & WhatsApp */}
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                                            <Phone className="w-4 h-4 text-green-600" />
                                        </div>
                                        <div className="space-y-1 flex-1 mt-1">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Teléfono</p>
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="text-sm font-semibold text-gray-900">
                                                    {client.telefono ? (
                                                        <a href={`tel:${client.telefono}`} className="hover:text-red-600 hover:underline">
                                                            {client.telefono}
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-400 italic font-medium">No proporcionado</span>
                                                    )}
                                                </div>
                                                {client.telefono && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs gap-1.5 font-bold text-green-700 bg-green-50 border-green-200 hover:bg-green-100 transition-colors"
                                                        onClick={() => window.open(`https://wa.me/52${client.telefono}`, '_blank')}
                                                    >
                                                        <Phone className="w-3 h-3" />
                                                        WhatsApp
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Address */}
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                            <MapPin className="w-4 h-4 text-indigo-600" />
                                        </div>
                                        <div className="space-y-1 flex-1 mt-1">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Dirección Fiscal / Operativa</p>
                                            <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap">
                                                {fullAddress ? fullAddress : <span className="text-gray-400 italic font-medium">Sin dirección registrada</span>}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Footer */}
                                <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex justify-end items-center gap-3">
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => setIsEditOpen(true)}
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold transition-all text-xs h-9 shadow-sm"
                                    >
                                        <Edit className="w-4 h-4 mr-2" />
                                        Editar Cliente
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white border-none shadow-2xl rounded-2xl text-slate-900">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <DialogTitle className="text-lg font-black text-gray-900 tracking-tight">Editar Información del Cliente</DialogTitle>
                    </div>
                    <div className="p-6">
                        <ClienteForm
                            initialData={client}
                            onSubmit={handleUpdate}
                            isLoading={isSubmitting}
                            onCancel={() => setShowConfirmCancel(true)}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de Confirmación de Cierre */}
            <Dialog open={showConfirmCancel} onOpenChange={setShowConfirmCancel}>
                <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[2rem] z-[60]">
                    <div className="p-8 space-y-6">
                        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <div className="text-center space-y-2">
                            <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">¿Descartar cambios?</DialogTitle>
                            <DialogDescription className="text-sm text-slate-500 font-medium">
                                Tienes datos que no han sido guardados. Si cancelas ahora, perderás estos cambios definitivamente.
                            </DialogDescription>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmCancel(false)}
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                            >
                                Continuar
                            </button>
                            <button
                                onClick={() => {
                                    setShowConfirmCancel(false);
                                    setIsEditOpen(false);
                                }}
                                className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-200 transition-all"
                            >
                                Descartar
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
