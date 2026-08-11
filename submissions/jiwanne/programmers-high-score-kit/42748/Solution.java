import java.util.Arrays;

class Solution {
    public int[] solution(int[] array, int[][] commands) {
        int[] answer = new int [commands.length];
        
        // 말을 조 온 나 귀찮게 써놧네
        for(int i = 0; i < commands.length; i++) {
            
            int a = commands[i][0];
            int b = commands[i][1];
            int c = commands[i][2];
            
            int [] temp = new int [b - a + 1];
            int count = 0;

            for(int j = a - 1; j < b; j++) {
                temp[count] = array[j];
                count++;
            }

            Arrays.sort(temp);
            answer[i] = temp[c-1];
        }
        
                
        
        return answer;
    }
}