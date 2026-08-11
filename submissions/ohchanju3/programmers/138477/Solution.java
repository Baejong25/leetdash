import java.util.*;

class Solution {
    /*
    [원리]
    최하위 점수 return
    1. k 크기의 배열에 score를 넣기 
    2. 배열은 sort하기. 해서 배열[k]번째를 발표 점수에 하나씩 넣기 
    - 배열 원소가 이미 k개 이상이면, score가 k 안의 원소들보다 커야 함. -> 배열[0]번째보다 크다면 배열[0] 원소 제거하고, 넣고 다시 정렬해야함 
    
    [알고리즘 순서]
    1. 명예의 전당 arraylist 만들기, ans 배열 만들기 (크기는 score.length)
    2. score 개수만큼 반복하기 
    2-1-1. 명예의전당 size가 k개 미만이면 score 넣기 
    2-1-2. 넣을때마다 정렬 -> 명예의전당[0]을 ans 배열에 넣기 
    2-2-1 k 이상이면, score랑 명예의전당[0] 크기 비교하기
    2-2-2 만약 score가 더 크다면 명예의전당[0] 대신 score 넣기 
    2-2-3 정렬하고 가장 작은 값 ans 배열에 넣기
    3. ans return 하기 
    */
    public int[] solution(int k, int[] score) {
        //int[] rank = new int[k];
        List<Integer> rank = new ArrayList<>();
        int[] ans = new int[score.length];
        
        for(int i=0; i<score.length; i++){
            if(rank.size() < k){
                rank.add(score[i]);
                //rank[i] = score[i];
                Collections.sort(rank);      
                ans[i] = rank.get(0);
            } else{
                if(score[i] > rank.get(0)){
                    rank.set(0, score[i]);
                    //rank[k] = score[i];
                    //Arrays.sort(rank);
                    Collections.sort(rank);
                    ans[i] = rank.get(0);
                } else ans[i] = rank.get(0);
            }
        }
        return ans;
    }
}