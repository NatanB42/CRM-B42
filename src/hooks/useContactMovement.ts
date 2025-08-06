import { useState, useCallback, useRef } from 'react';
import { Contact } from '../types';
import { updateContact } from '../lib/database';
import { useToast } from './useToast';

interface MovementState {
  contactId: string;
  fromStageId: string;
  toStageId: string;
  attempt: number;
  timestamp: number;
}

interface UseContactMovementProps {
  onOptimisticUpdate: (contactId: string, newStageId: string) => void;
  onRevertUpdate: (contactId: string, originalStageId: string) => void;
  onConfirmUpdate: (contactId: string, newStageId: string) => void; // ✅ NOVO: Callback para confirmar atualização
}

export const useContactMovement = ({ 
  onOptimisticUpdate, 
  onRevertUpdate,
  onConfirmUpdate
}: UseContactMovementProps) => {
  const [movingContacts, setMovingContacts] = useState<Set<string>>(new Set());
  const [failedMoves, setFailedMoves] = useState<Set<string>>(new Set());
  const toast = useToast();
  const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const movementQueue = useRef<Map<string, MovementState>>(new Map());

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [500, 1000, 2000]; // ✅ CORREÇÃO: Delays mais rápidos

  const clearRetryTimeout = (contactId: string) => {
    const timeout = retryTimeouts.current.get(contactId);
    if (timeout) {
      clearTimeout(timeout);
      retryTimeouts.current.delete(contactId);
    }
  };

  const executeMovement = useCallback(async (
    contactId: string, 
    newStageId: string, 
    originalStageId: string,
    attempt: number = 0
  ): Promise<boolean> => {
    try {
      console.log(`🎯 Executando movimento ${contactId} para etapa ${newStageId} (tentativa ${attempt + 1})`);
      
      // Mostrar loading para todas as tentativas
      setMovingContacts(prev => new Set(prev).add(contactId));
      
      setFailedMoves(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });

      // Atualização no banco de dados
      await updateContact(contactId, { stageId: newStageId });
      
      console.log(`✅ Contato ${contactId} salvo no banco com sucesso na etapa ${newStageId}`);
      
      // Confirmar atualização
      onConfirmUpdate(contactId, newStageId);
      
      // Sucesso - limpar estados
      setMovingContacts(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      movementQueue.current.delete(contactId);
      clearRetryTimeout(contactId);
      
      // Feedback de sucesso
      if (attempt > 0) {
        toast.success('Contato movido com sucesso!', 2000);
      } else {
        toast.success('Contato movido!', 1500);
      }
      
      return true;
      
    } catch (error) {
      console.error(`❌ Falha ao mover contato ${contactId}:`, error);
      
      // Retry logic
      if (attempt < MAX_RETRIES) {
        const nextAttempt = attempt + 1;
        const delay = RETRY_DELAYS[attempt] || 2000;
        
        console.log(`🔄 Agendando retry ${nextAttempt}/${MAX_RETRIES} para contato ${contactId} em ${delay}ms`);
        
        // Atualizar estado de movimento
        movementQueue.current.set(contactId, {
          contactId,
          fromStageId: originalStageId,
          toStageId: newStageId,
          attempt: nextAttempt,
          timestamp: Date.now()
        });
        
        // Manter loading ativo
        setMovingContacts(prev => new Set(prev).add(contactId));
        
        // Agendar retry
        const timeout = setTimeout(() => {
          executeMovement(contactId, newStageId, originalStageId, nextAttempt);
        }, delay);
        
        retryTimeouts.current.set(contactId, timeout);
        
        return false;
      } else {
        // Max retries atingido - reverter
        console.error(`💥 Max retries atingido para contato ${contactId}, revertendo...`);
        
        setMovingContacts(prev => {
          const newSet = new Set(prev);
          newSet.delete(contactId);
          return newSet;
        });
        
        setFailedMoves(prev => new Set(prev).add(contactId));
        
        // Reverter para posição original
        onRevertUpdate(contactId, originalStageId);
        
        movementQueue.current.delete(contactId);
        clearRetryTimeout(contactId);
        
        toast.error('Falha ao mover contato. Posição revertida.');
        
        // Auto-limpar estado de falha
        setTimeout(() => {
          setFailedMoves(prev => {
            const newSet = new Set(prev);
            newSet.delete(contactId);
            return newSet;
          });
        }, 5000);
        
        return false;
      }
    }
  }, [onRevertUpdate, onConfirmUpdate, toast]);

  const moveContact = useCallback((
    contactId: string, 
    newStageId: string, 
    originalStageId: string
  ) => {
    // Prevenir movimentos duplicados
    if (movingContacts.has(contactId)) {
      console.log(`⚠️ Contato ${contactId} já está sendo movido, ignorando...`);
      return;
    }

    // Verificar se já está na etapa correta
    if (originalStageId === newStageId) {
      console.log(`⚠️ Contato ${contactId} já está na etapa ${newStageId}, ignorando...`);
      return;
    }

    // Limpar retry existente
    clearRetryTimeout(contactId);
    
    console.log(`🚀 Iniciando movimento: ${contactId} de ${originalStageId} para ${newStageId}`);
    
    // Aplicar atualização otimista imediatamente
    onOptimisticUpdate(contactId, newStageId);
    
    // Executar movimento no banco de dados
    executeMovement(contactId, newStageId, originalStageId);
  }, [movingContacts, onOptimisticUpdate, executeMovement]);

  const retryFailedMove = useCallback((contactId: string) => {
    const movement = movementQueue.current.get(contactId);
    if (movement) {
      setFailedMoves(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      // Aplicar otimista novamente antes do retry
      onOptimisticUpdate(contactId, movement.toStageId);
      
      executeMovement(
        movement.contactId, 
        movement.toStageId, 
        movement.fromStageId, 
        0 // Resetar tentativas
      );
    }
  }, [executeMovement, onOptimisticUpdate]);

  const cancelMove = useCallback((contactId: string) => {
    const movement = movementQueue.current.get(contactId);
    if (movement) {
      clearRetryTimeout(contactId);
      
      setMovingContacts(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      setFailedMoves(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      // Reverter para posição original
      onRevertUpdate(contactId, movement.fromStageId);
      
      movementQueue.current.delete(contactId);
      
      toast.info('Movimento cancelado');
    }
  }, [onRevertUpdate, toast]);

  // Cleanup
  const cleanup = useCallback(() => {
    retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
    retryTimeouts.current.clear();
    movementQueue.current.clear();
  }, []);

  return {
    moveContact,
    retryFailedMove,
    cancelMove,
    cleanup,
    movingContacts,
    failedMoves,
    isMoving: (contactId: string) => movingContacts.has(contactId),
    hasFailed: (contactId: string) => failedMoves.has(contactId)
  };
};