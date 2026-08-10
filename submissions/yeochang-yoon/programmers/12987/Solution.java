import java.util.*;

class Solution {
    public int solution(int[] A, int[] B) {

        Arrays.sort(A);
        Arrays.sort(B);

        int len = A.length;
        int count = 0;
        int idxA = 0;
        int idxB = 0;

        while(idxA < len && idxB < len){
            if(A[idxA] < B[idxB]){
                count++;
                idxA++;
                idxB++;
            } else{
                idxB++;
            }
        }
        int answer = count;
        return answer;
    }
}