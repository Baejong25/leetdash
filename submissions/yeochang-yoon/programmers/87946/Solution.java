import java.util.*;

class Solution {

    List<int[]> list = new ArrayList<>();
    boolean[] visit;

    public int solution(int k, int[][] dungeons) {

        int n = dungeons.length;
        visit = new boolean[n];
        int[] arr = new int[n];

        func(0, arr);

        int result = 0;
        for(int i = 0; i < list.size(); i++){
            int sum = 0;
            int kk = k;
            for(int j = 0; j < n; j++){
                if(dungeons[list.get(i)[j]][0] > kk){
                    break;
                }
                kk -= dungeons[list.get(i)[j]][1];
                sum++;
            }

            result = Math.max(sum, result);
        }

        int answer = result;
        return answer;
    }

    private void func (int count, int[] arr){
        for(int i = 0; i < arr.length; i++){
            if(count == arr.length){
                list.add(arr.clone());
                return;
            }
            if(visit[i]){
                continue;
            }

            arr[count] = i;
            visit[i] = true;


            func(count+1, arr);

            arr[count] = 0;
            visit[i] = false;
        }
    }
}