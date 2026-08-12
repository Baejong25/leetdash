/*
    도난 맞은 학생의 앞뒤 번호의 학생이 여벌 체육복이 있으면 빌릴 수 있다. 
    최대한 많은 학생이 수업을 들을 수 있도
*/
import java.util.Arrays; 
class Solution {
    public int solution(int n, int[] lost, int[] reserve) {
        n -= lost.length;
        boolean[] borrowed = new boolean[lost.length]; 
        boolean[] used = new boolean[reserve.length];  
        Arrays.sort(lost); 
        Arrays.sort(reserve); 
        
        // lost 와 reserve 가 일치하는 케이스 
        for (int i = 0; i < reserve.length; i++) {        
            for (int j = 0; j < lost.length; j++) {
                if(reserve[i] == lost[j]) {
                    n++; 
                    borrowed[j] = true;
                    used[i] = true; 
                    break; 
                }    
            }
        }
        
        
        for (int i = 0; i < reserve.length; i++) {        
            for (int j = 0; j < lost.length; j++) {
                // 아직 안 빌린 애들 중에서 
                if (!borrowed[j] && !used[i]) {
                    if (reserve[i] - 1 == lost[j]) {
                        n++; 
                        borrowed[j] = true;
                        used[i] = true; 
                        break; 
                    }
                    
                    if (reserve[i] + 1 == lost[j]) {
                        n++; 
                        borrowed[j] = true;
                        used[i] = true; 
                        break;
                    }
                } 
            }
        }
        return n;
    }
}