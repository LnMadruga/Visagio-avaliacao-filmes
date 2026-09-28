import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ListMoviesParams } from "./client";
import type { MovieCreateInput, MovieUpdateInput, ReviewCreateInput } from "./types";

/**
 * Chaves de cache do React Query. Centralizadas aqui para que invalidações
 * (ex.: depois de criar/editar/excluir um filme) alcancem exatamente as
 * queries certas, sem strings mágicas espalhadas pelas páginas.
 */
export const queryKeys = {
  movies: (params: ListMoviesParams) => ["movies", params] as const,
  moviesAll: ["movies"] as const,
  movie: (id: string) => ["movie", id] as const,
  genres: ["genres"] as const,
  reviews: (movieId: string, page: number) => ["reviews", movieId, page] as const,
};

export function useMovies(params: ListMoviesParams) {
  return useQuery({
    queryKey: queryKeys.movies(params),
    queryFn: () => api.listMovies(params),
    placeholderData: (previousData) => previousData, // mantém a página atual visível ao trocar de página (evita "piscar")
    staleTime: 30_000,
  });
}

export function useMovie(skMovieId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.movie(skMovieId ?? ""),
    queryFn: () => api.getMovie(skMovieId as string),
    enabled: Boolean(skMovieId),
    staleTime: 30_000,
  });
}

export function useGenres() {
  return useQuery({
    queryKey: queryKeys.genres,
    queryFn: api.listGenres,
    staleTime: 5 * 60_000, // gêneros mudam pouco: cache mais longo
  });
}

export function useReviews(skMovieId: string | undefined, page: number) {
  return useQuery({
    queryKey: queryKeys.reviews(skMovieId ?? "", page),
    queryFn: () => api.listReviews(skMovieId as string, page),
    enabled: Boolean(skMovieId),
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MovieCreateInput) => api.createMovie(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.moviesAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.genres });
    },
  });
}

export function useUpdateMovie(skMovieId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MovieUpdateInput) => api.updateMovie(skMovieId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.movie(skMovieId), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.moviesAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.genres });
    },
  });
}

export function useDeleteMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skMovieId: string) => api.deleteMovie(skMovieId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.moviesAll });
    },
  });
}

export function useAddReview(skMovieId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReviewCreateInput) => api.addReview(skMovieId, data),
    onSuccess: () => {
      // a nova avaliação muda a média/contagem exibidas no detalhe e no catálogo
      queryClient.invalidateQueries({ queryKey: queryKeys.movie(skMovieId) });
      queryClient.invalidateQueries({ queryKey: ["reviews", skMovieId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.moviesAll });
    },
  });
}
