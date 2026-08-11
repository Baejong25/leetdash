import java.util.*;
/*
정수 배열 numbers가 주어집니다. 
numbers에서 서로 다른 인덱스에 있는 두 개의 수를 뽑아 더해서 
만들 수 있는 모든 수를 배열에 오름차순으로 담아 return 하도록 
solution 함수를 완성해주세요
*/

class Solution {
    public int[] solution(int[] numbers) {
        HashSet<Integer> set = new HashSet<>();
        
        for(int i=0; i<numbers.length; i++){
            for(int j=i+1; j<numbers.length; j++){
                int sum = numbers[i] + numbers[j];
                set.add(sum);
            }
        }
        int[] ans = new int[set.size()];
        int idx = 0;
        
        for(int num : set){
            ans[idx++] = num;
        }
        Arrays.sort(ans);
        return ans;
    }
}